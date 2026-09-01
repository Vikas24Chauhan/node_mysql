// import mysql from "mysql2/promise";

// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT || 3306,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,

//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// export default pool;

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("PostgreSQL connected successfully");
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

export default pool;
