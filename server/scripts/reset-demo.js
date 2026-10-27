// One-off maintenance script: drops every table so scripts/seed.js can
// rebuild a clean database. Usage: node scripts/reset-demo.js
// The models must be imported first — sequelize.sync() only knows about
// tables whose models are registered on the instance.
import { sequelize } from "../src/config/db.js";
import "../src/models/index.js";

await sequelize.authenticate();
await sequelize.sync({ force: true });
console.log("[reset] database rebuilt (all tables dropped)");
await sequelize.close();
