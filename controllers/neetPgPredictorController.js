import pool from "../config/db.js";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

// Configurable historical-rank heuristics; these are not probabilities.
const getPrediction = (candidateRank, closingRank) => {
  if (!Number.isFinite(closingRank) || closingRank <= 0) {
    return {
      prediction: "INSUFFICIENT_DATA",
      score: null,
    };
  }

  const ratio = candidateRank / closingRank;

  if (ratio <= 0.7) {
    return { prediction: "SAFE", score: 90 };
  }

  if (ratio <= 1) {
    return { prediction: "GOOD_CHANCE", score: 75 };
  }

  if (ratio <= 1.15) {
    return { prediction: "REACH", score: 50 };
  }

  return { prediction: "UNLIKELY", score: 20 };
};

const cleanFilter = (value) => {
  if (typeof value !== "string") return undefined;

  const cleaned = value.trim();
  return cleaned ? cleaned : undefined;
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const predictNeetPg2025 = async (req, res) => {
  try {
    const { rank, category, quota, state, course, institute, round } =
      req.query;

    const candidateRank = Number(rank);

    if (
      rank === undefined ||
      rank === "" ||
      !Number.isSafeInteger(candidateRank) ||
      candidateRank <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid NEET PG rank.",
      });
    }

    if (
      typeof category !== "string" ||
      !category.trim() ||
      typeof quota !== "string" ||
      !quota.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category and quota are required.",
      });
    }

    const pageNumber = Number(req.query.page ?? 1);
    const requestedLimit = Number(req.query.limit ?? PAGE_SIZE_DEFAULT);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values.",
      });
    }

    const pageSize = Math.min(requestedLimit, PAGE_SIZE_MAX);

    let selectedRound = null;

    if (round !== undefined && round !== "") {
      selectedRound = Number(round);

      if (
        !Number.isInteger(selectedRound) ||
        selectedRound < 1 ||
        selectedRound > 4
      ) {
        return res.status(400).json({
          success: false,
          message: "Round must be between 1 and 4.",
        });
      }
    }

    const filters = {
      state: cleanFilter(state),
      course: cleanFilter(course),
      institute: cleanFilter(institute),
    };

    const conditions = [
      "a.ai_rank IS NOT NULL",
      "a.ai_rank > 0",
      "a.category = $1",
      "a.quota = $2",
    ];

    const values = [category.trim(), quota.trim()];
    let paramIndex = values.length;

    const addFilter = (column, value) => {
      if (value !== undefined) {
        values.push(value);
        paramIndex += 1;
        conditions.push(`${column} = $${paramIndex}`);
      }
    };

    addFilter("a.state", filters.state);
    addFilter("a.course", filters.course);
    addFilter("a.institute", filters.institute);

    /*
     * IMPORTANT:
     * Do not filter a.round in the WHERE clause.
     * All rounds must first be grouped so the response can retain
     * complete round history. The selected round is applied later
     * when deciding which closing rank to use for prediction.
     */
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
        GROUP BY
          institute,
          course,
          state,
          quota,
          category
      )
      SELECT
        g.*,

        sm.seats,
        sm.stipend_year_1 AS matrix_stipend_year_1,
        sm.bond_years AS matrix_bond_years,
        sm.bond_penalty AS matrix_bond_penalty,
        sm.beds AS matrix_beds,

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

      /*
       * Aggregate seat-matrix rows instead of LIMIT 1.
       * This prevents multiple matching matrix records from
       * multiplying the allotment results.
       *
       * Seats are summed. Non-additive fields use MAX as a
       * deterministic fallback; verify their business meaning
       * if your source contains multiple distinct values.
       */
      LEFT JOIN LATERAL (
        SELECT
          SUM(COALESCE(s.seats, 0)) AS seats,
          MAX(s.stipend_year_1) AS stipend_year_1,
          MAX(s.bond_years) AS bond_years,
          MAX(s.bond_penalty) AS bond_penalty,
          MAX(s.beds) AS beds,

          MAX(s.cr_2024_1) AS cr_2024_1,
          MAX(s.cr_2024_2) AS cr_2024_2,
          MAX(s.cr_2024_3) AS cr_2024_3,
          MAX(s.cr_2024_4) AS cr_2024_4,
          MAX(s.cr_2024_5) AS cr_2024_5,

          MAX(s.cr_2025_1) AS cr_2025_1,
          MAX(s.cr_2025_2) AS cr_2025_2,
          MAX(s.cr_2025_3) AS cr_2025_3,
          MAX(s.cr_2025_4) AS cr_2025_4

        FROM neet_pg_seat_matrix_2025 s
        WHERE s.institute = g.institute
          AND s.course = g.course
          AND s.state = g.state
          AND s.quota = g.quota
          AND s.category = g.category
      ) sm ON TRUE

      /*
       * Aggregate fee/stipend/bond details too, so multiple
       * matching detail records do not duplicate result rows.
       */
      LEFT JOIN LATERAL (
        SELECT
          MAX(f.fee) AS fee,
          MAX(f.stipend_year_1) AS stipend_year_1,
          MAX(f.bond_years) AS bond_years,
          MAX(f.bond_penalty) AS bond_penalty,
          MAX(f.beds) AS beds
        FROM neet_pg_fee_stipend_bond_2025 f
        WHERE f.institute = g.institute
          AND f.course = g.course
          AND f.state = g.state
          AND f.quota = g.quota
      ) fsb ON TRUE

      ORDER BY g.best_closing_rank DESC NULLS LAST
    `;

    const { rows } = await pool.query(query, values);

    const predictions = rows.map((row) => {
      const rounds = (row.rounds || [])
        .map((item) => ({
          round: Number(item.round),
          opening_rank: toNullableNumber(item.opening_rank),
          closing_rank: toNullableNumber(item.closing_rank),
        }))
        .sort((a, b) => a.round - b.round);

      const latestRoundData = rounds.length ? rounds[rounds.length - 1] : null;

      const selectedRoundData =
        selectedRound === null
          ? null
          : rounds.find((item) => item.round === selectedRound);

      /*
       * When a round is selected, predict against that round's
       * cutoff and exclude colleges without data for that round.
       * When no round is selected, use the latest available
       * closing rank for the prediction.
       */
      const predictionRoundData = selectedRoundData || latestRoundData;

      const predictionClosingRank = toNullableNumber(
        predictionRoundData?.closing_rank,
      );

      const { prediction, score } = getPrediction(
        candidateRank,
        predictionClosingRank,
      );

      return {
        institute: row.institute,
        course: row.course,
        state: row.state,
        quota: row.quota,
        category: row.category,

        candidate_rank: candidateRank,

        opening_rank: toNullableNumber(row.opening_rank),
        best_closing_rank: toNullableNumber(row.best_closing_rank),

        latest_round: latestRoundData?.round ?? null,
        latest_closing_rank: latestRoundData?.closing_rank ?? null,

        selected_round: selectedRound,
        prediction_round: predictionRoundData?.round ?? null,
        prediction_closing_rank: predictionClosingRank,

        rounds,

        prediction,
        score,

        fee: row.details_fee ?? null,

        stipend:
          row.details_stipend_year_1 ?? row.matrix_stipend_year_1 ?? null,

        bond_years: row.details_bond_years ?? row.matrix_bond_years ?? null,

        bond_penalty:
          row.details_bond_penalty ?? row.matrix_bond_penalty ?? null,

        beds: row.details_beds ?? row.matrix_beds ?? null,

        seats: toNullableNumber(row.seats),

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

    const roundFilteredPredictions =
      selectedRound === null
        ? predictions
        : predictions.filter((item) =>
            item.rounds.some((itemRound) => itemRound.round === selectedRound),
          );

    const summary = {
      total: roundFilteredPredictions.length,

      safe: roundFilteredPredictions.filter(
        (item) => item.prediction === "SAFE",
      ).length,

      good_chance: roundFilteredPredictions.filter(
        (item) => item.prediction === "GOOD_CHANCE",
      ).length,

      reach: roundFilteredPredictions.filter(
        (item) => item.prediction === "REACH",
      ).length,

      unlikely: roundFilteredPredictions.filter(
        (item) => item.prediction === "UNLIKELY",
      ).length,

      insufficient_data: roundFilteredPredictions.filter(
        (item) => item.prediction === "INSUFFICIENT_DATA",
      ).length,
    };

    const sortOrder = {
      SAFE: 1,
      GOOD_CHANCE: 2,
      REACH: 3,
      UNLIKELY: 4,
      INSUFFICIENT_DATA: 5,
    };

    roundFilteredPredictions.sort((a, b) => {
      const predictionDifference =
        sortOrder[a.prediction] - sortOrder[b.prediction];

      if (predictionDifference !== 0) {
        return predictionDifference;
      }

      return (
        (a.prediction_closing_rank ?? Number.MAX_SAFE_INTEGER) -
        (b.prediction_closing_rank ?? Number.MAX_SAFE_INTEGER)
      );
    });

    const total = roundFilteredPredictions.length;
    const offset = (pageNumber - 1) * pageSize;

    const results = roundFilteredPredictions.slice(offset, offset + pageSize);

    return res.status(200).json({
      success: true,

      candidate: {
        rank: candidateRank,
        category: category.trim(),
        quota: quota.trim(),
        state: filters.state ?? null,
        course: filters.course ?? null,
        institute: filters.institute ?? null,
        round: selectedRound,
      },

      summary,

      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },

      disclaimer:
        "Historical rank-based estimates only. Labels and scores are heuristic, are not calibrated probabilities, and do not guarantee admission.",

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
