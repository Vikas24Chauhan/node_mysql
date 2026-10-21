import pool from "../config/db.js";

const RANK_COLUMNS = ["cr_2025_1", "cr_2025_2", "cr_2025_3", "cr_2025_4"];

// GREATEST / LEAST ignore NULLs in Postgres; NULLIF treats 0 as "no rank".
// Column names come from the RANK_COLUMNS whitelist only, never from user input.
const rankExpression = (fn, columns) =>
  columns.length === 1
    ? `NULLIF(${columns[0]}, 0)`
    : `${fn}(${columns.map((col) => `NULLIF(${col}, 0)`).join(", ")})`;

// =============== NEET PG Closing Ranks 2025 =================================

export const getPgClosingRanks2025 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      state,
      quota,
      category,
      course,
      institute,
      search,
      rankFrom,
      rankTo,
      round,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (state) {
      values.push(state);
      conditions.push(`state = $${values.length}`);
    }

    if (quota) {
      values.push(quota);
      conditions.push(`quota = $${values.length}`);
    }

    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (course) {
      values.push(course);
      conditions.push(`course = $${values.length}`);
    }

    if (institute) {
      values.push(`%${institute}%`);
      conditions.push(`institute ILIKE $${values.length}`);
    }

    // Optional round (1-4): limits the rank filter to that round's column and
    // only returns rows that have a closing rank in that round.
    const roundNumber = parseInt(round, 10);
    const rankColumns =
      roundNumber >= 1 && roundNumber <= RANK_COLUMNS.length
        ? [RANK_COLUMNS[roundNumber - 1]]
        : RANK_COLUMNS;

    if (rankColumns.length === 1) {
      conditions.push(`NULLIF(${rankColumns[0]}, 0) IS NOT NULL`);
    }

    // Rank range: the row's highest closing rank must be >= rankFrom and its
    // lowest must be <= rankTo. Rows with no ranks are excluded.
    const rankFromNumber = parseFloat(rankFrom);

    if (!Number.isNaN(rankFromNumber)) {
      values.push(rankFromNumber);
      conditions.push(
        `${rankExpression("GREATEST", rankColumns)} >= $${values.length}`,
      );
    }

    const rankToNumber = parseFloat(rankTo);

    if (!Number.isNaN(rankToNumber)) {
      values.push(rankToNumber);
      conditions.push(
        `${rankExpression("LEAST", rankColumns)} <= $${values.length}`,
      );
    }

    if (search) {
      values.push(`%${search}%`);

      conditions.push(`
        (
          institute ILIKE $${values.length}
          OR course ILIKE $${values.length}
          OR state ILIKE $${values.length}
          OR category ILIKE $${values.length}
          OR quota ILIKE $${values.length}
        )
      `);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Total records
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM neet_pg_closing_ranks_2025
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);

    const total = parseInt(countResult.rows[0].total, 10);

    // Data
    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitPosition = dataValues.length;

    dataValues.push(offset);
    const offsetPosition = dataValues.length;

    const dataQuery = `
      SELECT
        id,
        state,
        institute,
        course,
        quota,
        category,
        fee,
        cr_2025_1,
        cr_2025_2,
        cr_2025_3,
        cr_2025_4
      FROM neet_pg_closing_ranks_2025
      ${whereClause}
      ORDER BY id ASC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `;

    const dataResult = await pool.query(dataQuery, dataValues);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,
      data: dataResult.rows,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching PG 2025 closing ranks:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 closing ranks",
    });
  }
};

// =============== NEET PG Closing Ranks Filters 2025 ==========================

export const getPgClosingRankFilters2025 = async (req, res) => {
  try {
    const [statesResult, quotasResult, categoriesResult, coursesResult] =
      await Promise.all([
        pool.query(`
          SELECT DISTINCT state
          FROM neet_pg_closing_ranks_2025
          WHERE state IS NOT NULL AND state <> ''
          ORDER BY state ASC
        `),

        pool.query(`
          SELECT DISTINCT quota
          FROM neet_pg_closing_ranks_2025
          WHERE quota IS NOT NULL AND quota <> ''
          ORDER BY quota ASC
        `),

        pool.query(`
          SELECT DISTINCT category
          FROM neet_pg_closing_ranks_2025
          WHERE category IS NOT NULL AND category <> ''
          ORDER BY category ASC
        `),

        pool.query(`
          SELECT DISTINCT course
          FROM neet_pg_closing_ranks_2025
          WHERE course IS NOT NULL AND course <> ''
          ORDER BY course ASC
        `),
      ]);

    res.status(200).json({
      success: true,

      filters: {
        states: statesResult.rows.map((row) => row.state),
        quotas: quotasResult.rows.map((row) => row.quota),
        categories: categoriesResult.rows.map((row) => row.category),
        courses: coursesResult.rows.map((row) => row.course),
      },
    });
  } catch (error) {
    console.error("Error fetching PG 2025 closing rank filters:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 closing rank filters",
    });
  }
};
