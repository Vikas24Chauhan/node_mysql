import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import pool from "../config/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, "../data/pg_allotments_2025.csv");

const TABLE = "neet_pg_allotments_2025";
const BATCH_SIZE = 1000;
const COLUMN_COUNT = 12;

const SHOULD_RECREATE = process.argv.includes("--recreate");

const cleanHeader = (header) => {
  const cleaned = header
    .replace(/^\uFEFF/, "") // strip BOM
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (cleaned === "bond_yrs") return "bond_years";
  if (cleaned === "stipend" || cleaned === "stipend_yr_1") {
    return "stipend_year_1";
  }

  return cleaned;
};

const cleanInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const cleanedValue = String(value)
    .replace(/\*\*/g, "")
    .replace(/,/g, "")
    .trim();

  const number = parseInt(cleanedValue, 10);

  return Number.isNaN(number) ? null : number;
};

const cleanCurrency = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const cleanedValue = String(value)
    .replace(/\*\*/g, "")
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/"/g, "")
    .trim();

  if (!cleanedValue) {
    return null;
  }

  const number = Number(cleanedValue);

  return Number.isNaN(number) ? null : number;
};

const cleanText = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).replace(/\*\*/g, "").trim();

  return text === "" || text === "-" ? null : text;
};

const createTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id              SERIAL PRIMARY KEY,
      round           SMALLINT,
      ai_rank         INTEGER,
      state           TEXT,
      institute       TEXT,
      course          TEXT,
      branch          TEXT,
      quota           TEXT,
      category        TEXT,
      fee             NUMERIC(12, 2),
      stipend_year_1  NUMERIC(12, 2),
      bond_years      SMALLINT,
      beds            INTEGER
    )
  `);
};

// Indexes are created AFTER the bulk insert, which is much faster
const createIndexes = async (client) => {
  const indexes = [
    ["round", "round"],
    ["ai_rank", "ai_rank"],
    ["state", "state"],
    ["quota", "quota"],
    ["category", "category"],
    ["course", "course"],
    ["branch", "branch"],
  ];

  for (const [name, column] of indexes) {
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_pg25_${name} ON ${TABLE} (${column})`,
    );
  }
};

const insertBatch = async (rows, client) => {
  if (!rows.length) {
    return;
  }

  const values = [];
  const placeholders = [];

  rows.forEach((row, index) => {
    const base = index * COLUMN_COUNT;

    const params = Array.from(
      { length: COLUMN_COUNT },
      (_, i) => `$${base + i + 1}`,
    );

    placeholders.push(`(${params.join(", ")})`);

    values.push(
      cleanInteger(row.round), //  1 - ROUND
      cleanInteger(row.ai_rank), //  2 - AI RANK
      cleanText(row.state), //  3 - STATE
      cleanText(row.institute), //  4 - INSTITUTE
      cleanText(row.course), //  5 - COURSE
      cleanText(row.branch), //  6 - BRANCH
      cleanText(row.quota), //  7 - QUOTA
      cleanText(row.category), //  8 - CATEGORY
      cleanCurrency(row.fee), //  9 - FEE
      cleanCurrency(row.stipend_year_1), // 10 - STIPEND YEAR 1
      cleanInteger(row.bond_years), // 11 - BOND YEARS
      cleanInteger(row.beds), // 12 - BEDS
    );
  });

  const query = `
    INSERT INTO ${TABLE} (
      round,
      ai_rank,
      state,
      institute,
      course,
      branch,
      quota,
      category,
      fee,
      stipend_year_1,
      bond_years,
      beds
    )
    VALUES ${placeholders.join(",")}
  `;

  await client.query(query, values);
};

const importPgAllotments2025 = async () => {
  console.log("");
  console.log("==========================================");
  console.log("     NEET PG 2025 ALLOTMENTS IMPORT");
  console.log("==========================================");
  console.log("");

  console.log("CSV file:");
  console.log(csvFilePath);
  console.log("");

  if (!fs.existsSync(csvFilePath)) {
    console.error("❌ CSV file not found!");
    console.error("");
    console.error("Expected location:");
    console.error(csvFilePath);
    process.exit(1);
  }

  const client = await pool.connect();

  let totalRows = 0;
  let insertedRows = 0;
  let batch = [];

  try {
    await client.query("BEGIN");

    console.log("Connected to PostgreSQL.");
    console.log("Transaction started.");
    console.log("");

    if (SHOULD_RECREATE) {
      await client.query(`DROP TABLE IF EXISTS ${TABLE}`);
      console.log(`🗑️  Dropped old table "${TABLE}".`);
    }

    await createTable(client);
    console.log(`✅ Table "${TABLE}" is ready.`);

    // Safety net: if the table already had rows, warn instead of silently duplicating
    const { rows: existing } = await client.query(
      `SELECT COUNT(*)::int AS count FROM ${TABLE}`,
    );

    if (existing[0].count > 0) {
      throw new Error(
        `Table "${TABLE}" already has ${existing[0].count} rows. ` +
          `Run with --recreate to drop and reload it, or empty it first.`,
      );
    }

    console.log("");

    const stream = fs.createReadStream(csvFilePath).pipe(
      csv({
        mapHeaders: ({ header }) => cleanHeader(header),
      }),
    );

    for await (const row of stream) {
      batch.push(row);
      totalRows++;

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(batch, client);

        insertedRows += batch.length;

        console.log(`✅ Imported ${insertedRows.toLocaleString()} records`);

        batch = [];
      }
    }

    // Insert remaining rows
    if (batch.length > 0) {
      await insertBatch(batch, client);

      insertedRows += batch.length;

      console.log(`✅ Imported ${insertedRows.toLocaleString()} records`);
    }

    await createIndexes(client);
    console.log("✅ Indexes created.");

    await client.query("COMMIT");

    console.log("");
    console.log("==========================================");
    console.log("        IMPORT COMPLETED");
    console.log("==========================================");
    console.log("");

    console.log(`CSV records found : ${totalRows.toLocaleString()}`);
    console.log(`Records inserted  : ${insertedRows.toLocaleString()}`);

    console.log("");
    console.log("✅ NEET PG 2025 data successfully imported.");
    console.log("");
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("");
    console.error("==========================================");
    console.error("           IMPORT FAILED");
    console.error("==========================================");
    console.error("");

    console.error(error);

    console.error("");
    console.error("❌ Transaction rolled back.");
    console.error("No partial data should remain in the table.");

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

importPgAllotments2025();
