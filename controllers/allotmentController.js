import pool from "../config/db.js";

// ==========================================
// NEET PG 2025
// ==========================================

export const getPgAllotments2025 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      round,
      category,
      quota,
      state,
      course,
      institute,
      rankFrom,
      rankTo,
      search,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (round) {
      values.push(parseInt(round, 10));
      conditions.push(`round = $${values.length}`);
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

    if (institute) {
      values.push(`%${institute}%`);
      conditions.push(`institute ILIKE $${values.length}`);
    }

    if (rankFrom) {
      values.push(parseInt(rankFrom, 10));
      conditions.push(`ai_rank >= $${values.length}`);
    }

    if (rankTo) {
      values.push(parseInt(rankTo, 10));
      conditions.push(`ai_rank <= $${values.length}`);
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
      FROM neet_pg_allotments_2025
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
        round,
        ai_rank,
        state,
        institute,
        course,
        quota,
        category,
        fee,
        stipend,
        bond_years,
        beds
      FROM neet_pg_allotments_2025
      ${whereClause}
      ORDER BY ai_rank ASC
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
    console.error("Error fetching PG 2025 allotments:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch PG 2025 allotments",
    });
  }
};

// ==========================================
// INI-CET 2025
// ==========================================

export const getInicetAllotments2025 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      round,
      category,
      quota,
      state,
      course,
      institute,
      rankFrom,
      rankTo,
      search,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (round) {
      values.push(parseInt(round, 10));
      conditions.push(`round = $${values.length}`);
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

    if (institute) {
      values.push(`%${institute}%`);
      conditions.push(`institute ILIKE $${values.length}`);
    }

    if (rankFrom) {
      values.push(parseInt(rankFrom, 10));
      conditions.push(`ai_rank >= $${values.length}`);
    }

    if (rankTo) {
      values.push(parseInt(rankTo, 10));
      conditions.push(`ai_rank <= $${values.length}`);
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

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM inicet_allotments_2025
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);

    const total = parseInt(countResult.rows[0].total, 10);

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitPosition = dataValues.length;

    dataValues.push(offset);
    const offsetPosition = dataValues.length;

    const dataQuery = `
      SELECT
        id,
        round,
        ai_rank,
        state,
        institute,
        course,
        quota,
        category,
        fee,
        stipend,
        bond_years,
        beds
      FROM inicet_allotments_2025
      ${whereClause}
      ORDER BY ai_rank ASC
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
    console.error("Error fetching INI-CET 2025 allotments:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch INI-CET 2025 allotments",
    });
  }
};
