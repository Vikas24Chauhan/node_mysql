import pool from "../config/db.js";

const RANK_COLUMNS_2025 = ["cr_2025_1", "cr_2025_2", "cr_2025_3", "cr_2025_4"];
const RANK_COLUMNS_2024 = [
  "cr_2024_1",
  "cr_2024_2",
  "cr_2024_3",
  "cr_2024_4",
  "cr_2024_5",
];

// Column names come from this whitelist only, never from user input.
const RANK_COLUMNS = {
  2025: RANK_COLUMNS_2025,
  2024: RANK_COLUMNS_2024,
  both: [...RANK_COLUMNS_2025, ...RANK_COLUMNS_2024],
};

// GREATEST / LEAST ignore NULLs in Postgres; NULLIF treats 0 as "no rank".
const rankExpression = (fn, columns) =>
  `${fn}(${columns.map((col) => `NULLIF(${col}, 0)`).join(", ")})`;

export const getPgSeatMatrix2025 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      round,
      category,
      quota,
      state,
      course,
      branch,
      institute,
      search,
      minSeats,
      rankFrom,
      rankTo,
      rankView = "2025",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (round) {
      const roundNumber = parseInt(round, 10);

      if (!Number.isNaN(roundNumber)) {
        values.push(roundNumber);
        conditions.push(`round = $${values.length}`);
      }
    }

    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (quota) {
      values.push(quota);
      conditions.push(`quota = $${values.length}`);
    }

    if (state) {
      values.push(state);
      conditions.push(`state = $${values.length}`);
    }

    if (course) {
      values.push(course);
      conditions.push(`course = $${values.length}`);
    }

    if (branch) {
      values.push(branch);
      conditions.push(`branch = $${values.length}`);
    }

    if (institute) {
      values.push(`%${institute}%`);
      conditions.push(`institute ILIKE $${values.length}`);
    }

    const minSeatsNumber = parseInt(minSeats, 10);

    if (!Number.isNaN(minSeatsNumber)) {
      values.push(minSeatsNumber);
      conditions.push(`seats >= $${values.length}`);
    }

    // Rank range is checked against the closing ranks of the selected view
    // (2025 / 2024 / both): the row's highest rank must be >= rankFrom and
    // its lowest rank must be <= rankTo. Rows with no rank are excluded.
    const rankColumns = RANK_COLUMNS[rankView] || RANK_COLUMNS["2025"];

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
          OR branch ILIKE $${values.length}
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
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(seats), 0) AS total_seats
      FROM neet_pg_seat_matrix_2025
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);

    const total = parseInt(countResult.rows[0].total, 10);
    const totalSeats = parseInt(countResult.rows[0].total_seats, 10) || 0;

    // Data
    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitPosition = dataValues.length;

    dataValues.push(offset);
    const offsetPosition = dataValues.length;

    const dataQuery = `
      SELECT
        id,
        round,
        quota,
        category,
        state,
        institute,
        course,
        branch,
        seats,
        stipend_year_1,
        bond_years,
        bond_penalty,
        beds,
        cr_2024_1,
        cr_2024_2,
        cr_2024_3,
        cr_2024_4,
        cr_2024_5,
        cr_2025_1,
        cr_2025_2,
        cr_2025_3,
        cr_2025_4
      FROM neet_pg_seat_matrix_2025
      ${whereClause}
      ORDER BY state ASC, institute ASC, course ASC, id ASC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `;

    const dataResult = await pool.query(dataQuery, dataValues);

    const totalPages = Math.ceil(total / limitNumber);

    res.status(200).json({
      success: true,
      data: dataResult.rows,

      totalSeats,

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
    console.error("Error fetching PG 2025 seat matrix:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 seat matrix",
    });
  }
};

// =============== NEET PG Seat Matrix Filters 2025 ==========================

export const getPgSeatMatrixFilters2025 = async (req, res) => {
  try {
    const [
      roundsResult,
      statesResult,
      quotasResult,
      categoriesResult,
      coursesResult,
      branchesResult,
    ] = await Promise.all([
      pool.query(`
        SELECT DISTINCT round
        FROM neet_pg_seat_matrix_2025
        WHERE round IS NOT NULL
        ORDER BY round ASC
      `),

      pool.query(`
        SELECT DISTINCT state
        FROM neet_pg_seat_matrix_2025
        WHERE state IS NOT NULL AND state <> ''
        ORDER BY state ASC
      `),

      pool.query(`
        SELECT DISTINCT quota
        FROM neet_pg_seat_matrix_2025
        WHERE quota IS NOT NULL AND quota <> ''
        ORDER BY quota ASC
      `),

      pool.query(`
        SELECT DISTINCT category
        FROM neet_pg_seat_matrix_2025
        WHERE category IS NOT NULL AND category <> ''
        ORDER BY category ASC
      `),

      pool.query(`
        SELECT DISTINCT course
        FROM neet_pg_seat_matrix_2025
        WHERE course IS NOT NULL AND course <> ''
        ORDER BY course ASC
      `),

      pool.query(`
        SELECT DISTINCT branch
        FROM neet_pg_seat_matrix_2025
        WHERE branch IS NOT NULL AND branch <> ''
        ORDER BY branch ASC
      `),
    ]);

    res.status(200).json({
      success: true,

      filters: {
        rounds: roundsResult.rows.map((row) => row.round),
        states: statesResult.rows.map((row) => row.state),
        quotas: quotasResult.rows.map((row) => row.quota),
        categories: categoriesResult.rows.map((row) => row.category),
        courses: coursesResult.rows.map((row) => row.course),
        branches: branchesResult.rows.map((row) => row.branch),
      },
    });
  } catch (error) {
    console.error("Error fetching PG 2025 seat matrix filters:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 seat matrix filters",
    });
  }
};
