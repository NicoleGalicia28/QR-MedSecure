import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env regardless of the directory the process was started from,
// otherwise DB_DIALECT/JWT_SECRET silently fall back to their defaults.
const SERVER_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(SERVER_ROOT, ".env") });
dotenv.config();

const dialect = process.env.DB_DIALECT || "mysql";
const sqlitePath = path.isAbsolute(process.env.SQLITE_PATH || "")
  ? process.env.SQLITE_PATH
  : path.resolve(SERVER_ROOT, process.env.SQLITE_PATH || "./data/offline.db");
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

export const sequelize = new Sequelize({
  dialect,
  host: dialect === "mysql" ? process.env.DB_HOST : undefined,
  port: dialect === "mysql" ? Number(process.env.DB_PORT || 3306) : undefined,
  username: dialect === "mysql" ? process.env.DB_USER : undefined,
  password: dialect === "mysql" ? process.env.DB_PASS : undefined,
  database: dialect === "mysql" ? process.env.DB_NAME : undefined,
  storage: dialect === "sqlite" ? sqlitePath : undefined,
  logging: false,
  pool: dialect === "mysql" ? { max: 5, min: 0, acquire: 30000, idle: 10000 } : undefined,
});

export const sqliteSequelize = new Sequelize({
  dialect: "sqlite",
  storage: sqlitePath,
  logging: false,
});

export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("[DB] Connected to", dialect);
  } catch (err) {
    console.error("[DB] Connection error", err.message);
  }
}
