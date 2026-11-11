import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { testConnection, sequelize } from "./config/db.js";
import { ensureSchema } from "./config/schema.js";
import authRoutes from "./routes/auth.js";
import qrRoutes from "./routes/qr.js";
import beneficiaryRoutes from "./routes/beneficiaries.js";
import syncRoutes from "./routes/sync.js";
import adminRoutes from "./routes/admin.js";
import chairmanRoutes from "./routes/chairman.js";
import bhwRoutes from "./routes/bhw.js";
import notificationRoutes from "./routes/notifications.js";
import reportsRoutes from "./routes/reports.js";
import dataRoutes from "./routes/data.js";

// db.js loads server/.env, so the env vars are available from here on.
const app = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = process.env.API_PREFIX || "/api";
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Also accept the app when it is opened from another device on the same
// network (phone/tablet), e.g. http://192.168.1.9:5173. Only loopback and
// private LAN addresses are allowed, so this does not expose the API to
// the public internet.
const LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, same-origin requests, mobile WebViews.
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin) || LAN_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ status: "ok", name: "qr-medsecure-api" }));
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/qr`, qrRoutes);
app.use(`${API_PREFIX}/beneficiaries`, beneficiaryRoutes);
app.use(`${API_PREFIX}/sync`, syncRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/chairman`, chairmanRoutes);
app.use(`${API_PREFIX}/bhw`, bhwRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
// Top-level data endpoints (profile, dashboards, alerts, records,
// transactions, inventory, machine, scan, admin aliases).
app.use(API_PREFIX, dataRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

async function start() {
  await testConnection();
  try {
    // Create missing tables only — never alter/drop existing ones at boot.
    // Schema changes belong in explicit migrations or scripts/seed.js.
    await sequelize.sync();
  } catch (e) {
    console.error("[DB] Sync warning:", e.message);
  }
  try {
    // Additive-only column migrations for tables that already exist.
    await ensureSchema();
  } catch (e) {
    console.error("[DB] Migration warning:", e.message);
  }
  app.listen(PORT, () => console.log(`[API] http://localhost:${PORT}${API_PREFIX}`));
}

start();
