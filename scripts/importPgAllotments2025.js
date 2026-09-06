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

const BATCH_SIZE = 1000;

const cleanHeader = (header) => {
  return header.replace(/\*/g, "").trim().toLowerCase().replace(/\s+/g, "_");
};

const cleanInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const cleanedValue = String(value)
    .replace(/\*/g, "")
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
    .replace(/\*/g, "")
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

  return String(value).replace(/\*/g, "").trim();
};

const insertBatch = async (rows, client) => {
  if (!rows.length) {
    return;
  }

  const values = [];
  const placeholders = [];

  rows.forEach((row, index) => {
    const base = index * 11;

    placeholders.push(`
      (
        $${base + 1},
        $${base + 2},
        $${base + 3},
        $${base + 4},
        $${base + 5},
        $${base + 6},
        $${base + 7},
        $${base + 8},
        $${base + 9},
        $${base + 10},
        $${base + 11}
      )
    `);

    values.push(
      // 1
      cleanInteger(row.round),

      // 2
      cleanInteger(row.ai_rank),

      // 3
      cleanText(row.state),

      // 4
      cleanText(row.institute),

      // 5
      cleanText(row.course),

      // 6
      cleanText(row.quota),

      // 7
      cleanText(row.category),

      // 8
      cleanCurrency(row.fee),

      // 9
      cleanCurrency(row.stipend),

      // 10
      cleanInteger(row.bond_years),

      // 11
      cleanInteger(row.beds),
    );
  });

  const query = `
    INSERT INTO neet_pg_allotments_2025 (
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
    )
    VALUES ${placeholders.join(",")}
  `;

  await client.query(query, values);
};

const importPgAllotments2025 = async () => {
  console.log("");
  console.log("==========================================");
  console.log("   NEET PG 2025 ALLOTMENTS IMPORT");
  console.log("==========================================");
  console.log("");

  console.log("CSV file:");
  console.log(csvFilePath);
  console.log("");

  if (!fs.existsSync(csvFilePath)) {
    console.error("❌ CSV file not found!");
    console.error("");
    console.error(`Expected location:`);
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

    if (batch.length > 0) {
      await insertBatch(batch, client);

      insertedRows += batch.length;

      console.log(`✅ Imported ${insertedRows.toLocaleString()} records`);
    }

    await client.query("COMMIT");

    console.log("");
    console.log("==========================================");
    console.log("          IMPORT COMPLETED");
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
    console.error("             IMPORT FAILED");
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
