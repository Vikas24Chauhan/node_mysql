import pool from "../config/db.js";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

const getPrediction = (candidateRank, closingRank) => {
  if (!closingRank || closingRank <= 0) {
    return {
      prediction: "INSUFFICIENT_DATA",
      score: null,
    };
  }

  // These are provisional historical heuristics, not admission probabilities.
  if (candidateRank <= closingRank * 0.8) {
    return { prediction: "SAFE", score: 90 };
  }

  if (candidateRank <= closingRank) {
    return { prediction: "GOOD_CHANCE", score: 75 };
  }

  if (candidateRank <= closingRank * 1.2) {
    return { prediction: "REACH", score: 50 };
  }

  return { prediction: "UNLIKELY", score: 0 };
};

export const predictNeetPg2025 = async (req, res) => {
  try {
    const {
      rank,
      category,
      quota,
      state,
      course,
      institute,
      round,
      page = "1",
      limit = String(PAGE_SIZE_DEFAULT),
    } = req.query;

    const candidateRank = Number(rank);

    if (!rank || !Number.isSafeInteger(candidateRank) || candidateRank <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid NEET PG rank.",
      });
    }

    if (!category || !quota) {
      return res.status(400).json({
        success: false,
        message: "Category and quota are required.",
      });
    }

    const pageNumber = Number(page);
    const pageSize = Math.min(Number(limit), PAGE_SIZE_MAX);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values.",
      });
    }

    if (
      round !== undefined &&
      (!Number.isInteger(Number(round)) ||
        Number(round) < 1 ||
        Number(round) > 4)
    ) {
      return res.status(400).json({
        success: false,
        message: "Round must be between 1 and 4.",
      });
    }

    const conditions = [
      "a.ai_rank IS NOT NULL",
      "a.ai_rank > 0",
      "a.category = $1",
      "a.quota = $2",
    ];

    const values = [category.trim(), quota.trim()];
    let index = values.length;

    const addFilter = (column, value) => {
      if (value !== undefined && value.trim() !== "") {
        values.push(value.trim());
        conditions.push(`${column} = $${++index}`);
      }
    };

    addFilter("a.state", state);
    addFilter("a.course", course);
    addFilter("a.institute", institute);

    if (round !== undefined) {
      values.push(Number(round));
      conditions.push(`a.round = $${++index}`);
    }

    const query = `
      WITH filtered AS (
        SELECT
          a.institute,
          a.course,
          a.state,
          a.quota,
          a.category,
          a.round,
          MIN(a.ai_rank)::bigint AS opening_rank,
          MAX(a.ai_rank)::bigint AS closing_rank
        FROM neet_pg_allotments_2025 a
        WHERE ${conditions.join(" AND ")}
        GROUP BY
          a.institute,
          a.course,
          a.state,
          a.quota,
          a.category,
          a.round
      ),
      grouped AS (
        SELECT
          institute,
          course,
          state,
          quota,
          category,
          MIN(opening_rank)::bigint AS opening_rank,
          MAX(closing_rank)::bigint AS best_closing_rank,
          json_agg(
            json_build_object(
              'round', round,
              'opening_rank', opening_rank,
              'closing_rank', closing_rank
            )
            ORDER BY round
          ) AS rounds
        FROM filtered
        GROUP BY institute, course, state, quota, category
      )
      SELECT
        g.*,
        sm.seats,
        sm.stipend_year_1 AS matrix_stipend_year_1,
        sm.bond_years AS matrix_bond_years,
        sm.bond_penalty,
        sm.beds,
        sm.cr_2024_1,
        sm.cr_2024_2,
        sm.cr_2024_3,
        sm.cr_2024_4,
        sm.cr_2024_5,
        sm.cr_2025_1,
        sm.cr_2025_2,
        sm.cr_2025_3,
        sm.cr_2025_4,
        fsb.fee AS details_fee,
        fsb.stipend_year_1 AS details_stipend_year_1,
        fsb.bond_years AS details_bond_years,
        fsb.bond_penalty AS details_bond_penalty,
        fsb.beds AS details_beds
      FROM grouped g
      LEFT JOIN LATERAL (
        SELECT s.*
        FROM neet_pg_seat_matrix_2025 s
        WHERE s.institute = g.institute
          AND s.course = g.course
          AND s.state = g.state
          AND s.quota = g.quota
          AND s.category = g.category
        ORDER BY
          CASE WHEN s.round = (
            SELECT MAX((r->>'round')::integer)
            FROM json_array_elements(g.rounds) r
          ) THEN 0 ELSE 1 END,
          s.round DESC
        LIMIT 1
      ) sm ON TRUE
      LEFT JOIN LATERAL (
        SELECT f.*
        FROM neet_pg_fee_stipend_bond_2025 f
        WHERE f.institute = g.institute
          AND f.course = g.course
          AND f.state = g.state
          AND f.quota = g.quota
        LIMIT 1
      ) fsb ON TRUE
      ORDER BY g.best_closing_rank DESC
    `;

    const { rows } = await pool.query(query, values);

    const predictions = rows.map((row) => {
      const rounds = row.rounds || [];
      const closingRank = Number(row.best_closing_rank);
      const { prediction, score } = getPrediction(candidateRank, closingRank);

      return {
        institute: row.institute,
        course: row.course,
        state: row.state,
        quota: row.quota,
        category: row.category,

        candidate_rank: candidateRank,
        opening_rank: Number(row.opening_rank),
        best_closing_rank: closingRank,
        rounds,

        // The score is a heuristic index, not a probability.
        prediction,
        score,

        fee: row.details_fee ?? null,
        stipend:
          row.details_stipend_year_1 ?? row.matrix_stipend_year_1 ?? null,
        bond_years: row.details_bond_years ?? row.matrix_bond_years ?? null,
        bond_penalty: row.details_bond_penalty ?? row.bond_penalty ?? null,
        beds: row.details_beds ?? row.beds ?? null,
        seats: row.seats ?? null,

        historical_cutoffs: {
          cr_2024_1: row.cr_2024_1 ?? null,
          cr_2024_2: row.cr_2024_2 ?? null,
          cr_2024_3: row.cr_2024_3 ?? null,
          cr_2024_4: row.cr_2024_4 ?? null,
          cr_2024_5: row.cr_2024_5 ?? null,
          cr_2025_1: row.cr_2025_1 ?? null,
          cr_2025_2: row.cr_2025_2 ?? null,
          cr_2025_3: row.cr_2025_3 ?? null,
          cr_2025_4: row.cr_2025_4 ?? null,
        },
      };
    });

    const visiblePredictions = predictions.filter(
      (item) => item.prediction !== "UNLIKELY",
    );

    const summary = {
      total: visiblePredictions.length,
      safe: visiblePredictions.filter((item) => item.prediction === "SAFE")
        .length,
      good_chance: visiblePredictions.filter(
        (item) => item.prediction === "GOOD_CHANCE",
      ).length,
      reach: visiblePredictions.filter((item) => item.prediction === "REACH")
        .length,
      insufficient_data: predictions.filter(
        (item) => item.prediction === "INSUFFICIENT_DATA",
      ).length,
    };

    const sortOrder = {
      SAFE: 1,
      GOOD_CHANCE: 2,
      REACH: 3,
      INSUFFICIENT_DATA: 4,
    };

    visiblePredictions.sort((a, b) => {
      const categoryDifference =
        sortOrder[a.prediction] - sortOrder[b.prediction];

      if (categoryDifference !== 0) return categoryDifference;

      return a.best_closing_rank - b.best_closing_rank;
    });

    const offset = (pageNumber - 1) * pageSize;
    const results = visiblePredictions.slice(offset, offset + pageSize);

    return res.status(200).json({
      success: true,
      candidate: {
        rank: candidateRank,
        category,
        quota,
        state: state || null,
        course: course || null,
        institute: institute || null,
        round: round ? Number(round) : null,
      },
      summary,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: visiblePredictions.length,
        total_pages: Math.ceil(visiblePredictions.length / pageSize),
      },
      disclaimer:
        "Historical estimates only. These labels are not admission guarantees or calibrated probabilities.",
      results,
    });
  } catch (error) {
    console.error("NEET PG Predictor Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate NEET PG prediction.",
    });
  }
};
