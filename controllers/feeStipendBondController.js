import pool from "../config/db.js";

// =============== NEET PG Fee / Stipend / Bond 2025 ==========================

export const getPgFeeStipendBond2025 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      state,
      quota,
      course,
      institute,
      search,
      bond,
      bondYears,
      minFee,
      maxFee,
      minBeds,
      maxBeds,
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

    if (course) {
      values.push(course);
      conditions.push(`course = $${values.length}`);
    }

    if (institute) {
      values.push(`%${institute}%`);
      conditions.push(`institute ILIKE $${values.length}`);
    }

    // bond=yes  -> seats with a bond (bond_years > 0)
    // bond=no   -> seats with no bond (bond_years = 0)
    // Rows with unknown bond info (NULL) match neither.
    if (bond === "yes") {
      conditions.push(`bond_years > 0`);
    } else if (bond === "no") {
      conditions.push(`bond_years = 0`);
    }

    // bondYears=2    -> exact bond length (0 = no bond)
    // bondYears=na   -> bond info not available (NULL)
    if (bondYears) {
      if (String(bondYears).toLowerCase() === "na") {
        conditions.push(`bond_years IS NULL`);
      } else {
        const bondYearsNumber = parseInt(bondYears, 10);

        if (!Number.isNaN(bondYearsNumber)) {
          values.push(bondYearsNumber);
          conditions.push(`bond_years = $${values.length}`);
        }
      }
    }

    const minFeeNumber = parseFloat(minFee);

    if (!Number.isNaN(minFeeNumber)) {
      values.push(minFeeNumber);
      conditions.push(`fee >= $${values.length}`);
    }

    const maxFeeNumber = parseFloat(maxFee);

    if (!Number.isNaN(maxFeeNumber)) {
      values.push(maxFeeNumber);
      conditions.push(`fee <= $${values.length}`);
    }

    const minBedsNumber = parseInt(minBeds, 10);

    if (!Number.isNaN(minBedsNumber)) {
      values.push(minBedsNumber);
      conditions.push(`beds >= $${values.length}`);
    }

    const maxBedsNumber = parseInt(maxBeds, 10);

    if (!Number.isNaN(maxBedsNumber)) {
      values.push(maxBedsNumber);
      conditions.push(`beds <= $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);

      conditions.push(`
        (
          institute ILIKE $${values.length}
          OR course ILIKE $${values.length}
          OR state ILIKE $${values.length}
          OR quota ILIKE $${values.length}
        )
      `);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Total records
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM neet_pg_fee_stipend_bond_2025
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
        fee,
        beds,
        bond_years,
        bond_penalty,
        stipend_year_1
      FROM neet_pg_fee_stipend_bond_2025
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
    console.error("Error fetching PG 2025 fee / stipend / bond:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 fee / stipend / bond",
    });
  }
};

// =============== NEET PG Fee / Stipend / Bond Filters 2025 ====================

export const getPgFeeStipendBondFilters2025 = async (req, res) => {
  try {
    const [
      statesResult,
      quotasResult,
      coursesResult,
      bondYearsResult,
      unknownBondResult,
    ] = await Promise.all([
      pool.query(`
        SELECT DISTINCT state
        FROM neet_pg_fee_stipend_bond_2025
        WHERE state IS NOT NULL AND state <> ''
        ORDER BY state ASC
      `),

      pool.query(`
        SELECT DISTINCT quota
        FROM neet_pg_fee_stipend_bond_2025
        WHERE quota IS NOT NULL AND quota <> ''
        ORDER BY quota ASC
      `),

      pool.query(`
        SELECT DISTINCT course
        FROM neet_pg_fee_stipend_bond_2025
        WHERE course IS NOT NULL AND course <> ''
        ORDER BY course ASC
      `),

      pool.query(`
        SELECT DISTINCT bond_years
        FROM neet_pg_fee_stipend_bond_2025
        WHERE bond_years IS NOT NULL
        ORDER BY bond_years ASC
      `),

      pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM neet_pg_fee_stipend_bond_2025
          WHERE bond_years IS NULL
        ) AS has_unknown
      `),
    ]);

    res.status(200).json({
      success: true,

      filters: {
        states: statesResult.rows.map((row) => row.state),
        quotas: quotasResult.rows.map((row) => row.quota),
        courses: coursesResult.rows.map((row) => row.course),
        bondYears: bondYearsResult.rows.map((row) => row.bond_years),
        hasUnknownBond: unknownBondResult.rows[0].has_unknown,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching PG 2025 fee / stipend / bond filters:",
      error,
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 fee / stipend / bond filters",
    });
  }
};
