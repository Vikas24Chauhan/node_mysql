import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import pool from "../config/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, "../data/pg_seat_matrix_2025.csv");

const TABLE_NAME = "neet_pg_seat_matrix_2025";
const BATCH_SIZE = 1000;

// Column order here == column order in the INSERT.
// 21 columns x 1000 rows = 21,000 params (Postgres limit is 65,535).
const COLUMNS = [
  { name: "round", type: "integer" },
  { name: "quota", type: "text" },
  { name: "category", type: "text" },
  { name: "state", type: "text" },
  { name: "institute", type: "text" },
  { name: "course", type: "text" },
  { name: "branch", type: "text" },
  { name: "seats", type: "integer" },
  { name: "stipend_year_1", type: "currency" },
  { name: "bond_years", type: "integer" },
  { name: "bond_penalty", type: "currency" },
  { name: "beds", type: "integer" },
  { name: "cr_2024_1", type: "integer" },
  { name: "cr_2024_2", type: "integer" },
  { name: "cr_2024_3", type: "integer" },
  { name: "cr_2024_4", type: "integer" },
  { name: "cr_2024_5", type: "integer" },
  { name: "cr_2025_1", type: "integer" },
  { name: "cr_2025_2", type: "integer" },
  { name: "cr_2025_3", type: "integer" },
  { name: "cr_2025_4", type: "integer" },
];

const cleanHeader = (header) => {
  return header
    .replace(/^\uFEFF/, "") // strip BOM (your "round" header has one)
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
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

  const cleaned = String(value).replace(/\*\*/g, "").trim();

  return cleaned === "" ? null : cleaned;
};

const cleaners = {
  integer: cleanInteger,
  currency: cleanCurrency,
  text: cleanText,
};

const sqlType = {
  integer: "INTEGER",
  currency: "NUMERIC(14, 2)",
  text: "TEXT",
};

// Creates the table only if it doesn't exist yet.
// If you already created it yourself, this is a harmless no-op.
const ensureTable = async (client) => {
  const columnDefs = COLUMNS.map(
    (col) => `${col.name} ${sqlType[col.type]}`,
  ).join(",\n      ");

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id SERIAL PRIMARY KEY,
      ${columnDefs}
    )
  `);
};

const insertBatch = async (rows, client) => {
  if (!rows.length) {
    return;
  }

  const colCount = COLUMNS.length;
  const values = [];
  const placeholders = [];

  rows.forEach((row, rowIndex) => {
    const base = rowIndex * colCount;

    const rowPlaceholders = COLUMNS.map(
      (_, colIndex) => `$${base + colIndex + 1}`,
    );

    placeholders.push(`(${rowPlaceholders.join(", ")})`);

    COLUMNS.forEach((col) => {
      values.push(cleaners[col.type](row[col.name]));
    });
  });

  const query = `
    INSERT INTO ${TABLE_NAME} (
      ${COLUMNS.map((col) => col.name).join(",\n      ")}
    )
    VALUES ${placeholders.join(",")}
  `;

  await client.query(query, values);
};

const importPgSeatMatrix2025 = async () => {
  console.log("");
  console.log("==========================================");
  console.log("     NEET PG 2025 SEAT MATRIX IMPORT");
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

    await ensureTable(client);

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

    await client.query("COMMIT");

    console.log("");
    console.log("==========================================");
    console.log("        IMPORT COMPLETED");
    console.log("==========================================");
    console.log("");

    console.log(`CSV records found : ${totalRows.toLocaleString()}`);
    console.log(`Records inserted  : ${insertedRows.toLocaleString()}`);

    console.log("");
    console.log("✅ NEET PG 2025 seat matrix successfully imported.");
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

importPgSeatMatrix2025();
