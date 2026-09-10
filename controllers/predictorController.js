import pool from "../config/db.js";

export const predictNeetPg2025 = async (req, res) => {
  try {
    const { rank, category, quota, state, course, institute } = req.query;

    if (!rank) {
      return res.status(400).json({
        success: false,
        message: "NEET PG rank is required",
      });
    }

    const candidateRank = Number(rank);

    if (!Number.isInteger(candidateRank) || candidateRank <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid NEET PG rank",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!quota) {
      return res.status(400).json({
        success: false,
        message: "Quota is required",
      });
    }

    const conditions = [`category = $1`, `quota = $2`, `ai_rank IS NOT NULL`];

    const values = [category, quota];
    let paramIndex = 3;

    if (state) {
      conditions.push(`state = $${paramIndex}`);
      values.push(state);
      paramIndex++;
    }

    if (course) {
      conditions.push(`course = $${paramIndex}`);
      values.push(course);
      paramIndex++;
    }

    if (institute) {
      conditions.push(`institute = $${paramIndex}`);
      values.push(institute);
      paramIndex++;
    }

    const query = `
      SELECT
        institute,
        course,
        state,
        quota,
        category,
        round,
        MIN(ai_rank) AS opening_rank,
        MAX(ai_rank) AS closing_rank,
        MIN(fee) AS fee,
        MIN(stipend) AS stipend,
        MAX(bond_years) AS bond_years,
        MAX(beds) AS beds
      FROM neet_pg_allotments_2025
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        institute,
        course,
        state,
        quota,
        category,
        round
      ORDER BY
        institute,
        course,
        round
    `;

    const result = await pool.query(query, values);

    const collegeMap = new Map();

    for (const row of result.rows) {
      const key = [
        row.institute,
        row.course,
        row.state,
        row.quota,
        row.category,
      ].join("|");

      if (!collegeMap.has(key)) {
        collegeMap.set(key, {
          institute: row.institute,
          course: row.course,
          state: row.state,
          quota: row.quota,
          category: row.category,
          fee: row.fee,
          stipend: row.stipend,
          bond_years: row.bond_years,
          beds: row.beds,
          rounds: [],
        });
      }

      collegeMap.get(key).rounds.push({
        round: Number(row.round),
        opening_rank: Number(row.opening_rank),
        closing_rank: Number(row.closing_rank),
      });
    }

    const predictions = [];

    for (const college of collegeMap.values()) {
      const rounds = college.rounds.sort((a, b) => a.round - b.round);

      const bestClosingRank = Math.max(
        ...rounds.map((item) => item.closing_rank),
      );

      const latestRound = rounds[rounds.length - 1];

      let prediction = "UNLIKELY";
      let score = 0;

      if (candidateRank <= bestClosingRank * 0.8) {
        prediction = "SAFE";
        score = 90;
      } else if (candidateRank <= bestClosingRank) {
        prediction = "GOOD_CHANCE";
        score = 75;
      } else if (candidateRank <= bestClosingRank * 1.2) {
        prediction = "REACH";
        score = 50;
      }

      if (prediction !== "UNLIKELY") {
        predictions.push({
          ...college,
          candidate_rank: candidateRank,
          best_closing_rank: bestClosingRank,
          latest_round: latestRound.round,
          latest_closing_rank: latestRound.closing_rank,
          prediction,
          score,
        });
      }
    }

    predictions.sort((a, b) => {
      const scoreDifference = b.score - a.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return a.best_closing_rank - b.best_closing_rank;
    });

    const safe = predictions.filter((item) => item.prediction === "SAFE");

    const goodChance = predictions.filter(
      (item) => item.prediction === "GOOD_CHANCE",
    );

    const reach = predictions.filter((item) => item.prediction === "REACH");

    return res.json({
      success: true,

      candidate: {
        rank: candidateRank,
        category,
        quota,
        state: state || null,
        course: course || null,
        institute: institute || null,
      },

      summary: {
        total: predictions.length,
        safe: safe.length,
        good_chance: goodChance.length,
        reach: reach.length,
      },

      results: predictions,
    });
  } catch (error) {
    console.error("NEET PG Predictor Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate NEET PG prediction",
    });
  }
};
