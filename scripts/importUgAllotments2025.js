import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, "../data/ug_allotments_2025.csv");

const BATCH_SIZE = 1000;

const cleanHeader = (header) => {
  const cleaned = header
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

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

  return String(value).replace(/\*\*/g, "").trim();
};

const insertBatch = async (rows, client) => {
  if (!rows.length) {
    return;
  }

  const values = [];
  const placeholders = [];

  rows.forEach((row, index) => {
    const base = index * 12;

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
        $${base + 11},
        $${base + 12}
      )
    `);

    values.push(
      cleanInteger(row.round),
      cleanInteger(row.ai_rank),
      cleanText(row.state),
      cleanText(row.institute),
      cleanText(row.course),
      cleanText(row.quota),
      cleanText(row.category),
      cleanCurrency(row.fee),
      cleanInteger(row.beds),
      cleanInteger(row.bond_years),
      cleanCurrency(row.bond_penalty),
      cleanCurrency(row.stipend),
    );
  });

  const query = `
    INSERT INTO ug_allotments_2025 (
      round,
      ai_rank,
      state,
      institute,
      course,
      quota,
      category,
      fee,
      beds,
      bond_years,
      bond_penalty,
      stipend
    )
    VALUES ${placeholders.join(",")}
  `;

  await client.query(query, values);
};

const importUgAllotments2025 = async () => {
  console.log("");
  console.log("==========================================");
  console.log("      UG 2025 ALLOTMENTS IMPORT");
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

    const stream = fs.createReadStream(csvFilePath).pipe(
      csv({
        mapHeaders: ({ header }) => {
          const cleaned = cleanHeader(header);

          if (cleaned === "stipend_year_1") {
            return "stipend";
          }

          return cleaned;
        },
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
    console.log("        IMPORT COMPLETED");
    console.log("==========================================");
    console.log("");

    console.log(`CSV records found : ${totalRows.toLocaleString()}`);
    console.log(`Records inserted  : ${insertedRows.toLocaleString()}`);

    console.log("");
    console.log("✅ UG 2025 data successfully imported.");
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

importUgAllotments2025();
