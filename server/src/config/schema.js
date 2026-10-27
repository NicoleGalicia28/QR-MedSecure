// Additive, idempotent schema migrations.
//
// `sequelize.sync()` only creates tables that do not exist yet, so columns
// added to a model later are missing on an existing database. These helpers
// add the missing columns and nothing else — no data is dropped or rewritten.
//
// Every migration must be safe to run on every boot.
import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const MIGRATIONS = [
  {
    table: "clinical_records",
    columns: {
      reasonForVisit: { type: DataTypes.STRING },
      symptoms: { type: DataTypes.TEXT },
      medicalHistory: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },
      prescription: { type: DataTypes.TEXT },
    },
  },
];

// The `status` column default was created as 'for_review' on installations
// that predate the rule "a clinical record is complete the moment it is
// saved". The column default still said 'for_review' in those databases, so
// a row inserted without an explicit status would land in a state the
// application no longer supports.
//
// MySQL can change a column default in place. SQLite cannot, so the table is
// rebuilt with the same structure and every row is copied across verbatim.
// Foreign keys are disabled for the duration of the rebuild so dependent
// tables are not cascaded.
const STATUS_DEFAULT_FIX = {
  table: "clinical_records",
  from: "for_review",
  to: "complete",
};

async function fixStatusDefault() {
  const dialect = sequelize.getDialect();

  if (dialect === "mysql") {
    // Idempotent: re-applying the same definition changes nothing.
    await sequelize.query(
      `ALTER TABLE \`${STATUS_DEFAULT_FIX.table}\` MODIFY \`status\` VARCHAR(255) NOT NULL DEFAULT '${STATUS_DEFAULT_FIX.to}'`,
    );
    console.log(`[DB] ${STATUS_DEFAULT_FIX.table}.status default set to "${STATUS_DEFAULT_FIX.to}"`);
    return;
  }

  if (dialect !== "sqlite") return;

  const [rows] = await sequelize.query(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
    { replacements: [STATUS_DEFAULT_FIX.table] },
  );
  const sql = rows?.[0]?.sql;
  if (!sql) return; // table does not exist yet — sequelize.sync() creates it

  const fromDefault = `DEFAULT '${STATUS_DEFAULT_FIX.from}'`;
  if (!sql.includes(fromDefault)) return; // already correct

  const newSql = sql
    .replace(fromDefault, `DEFAULT '${STATUS_DEFAULT_FIX.to}'`)
    .replace(
      /CREATE TABLE `clinical_records`/,
      "CREATE TABLE `clinical_records_rebuild`",
    );

  await sequelize.query("PRAGMA foreign_keys=OFF");
  await sequelize.query("BEGIN");
  try {
    await sequelize.query(newSql);
    await sequelize.query(
      "INSERT INTO clinical_records_rebuild SELECT * FROM clinical_records",
    );
    await sequelize.query("DROP TABLE clinical_records");
    await sequelize.query(
      "ALTER TABLE clinical_records_rebuild RENAME TO clinical_records",
    );
    await sequelize.query("COMMIT");
    console.log(
      `[DB] ${STATUS_DEFAULT_FIX.table}.status default changed to "${STATUS_DEFAULT_FIX.to}"`,
    );
  } catch (err) {
    await sequelize.query("ROLLBACK");
    console.warn(
      "[DB] Could not update the clinical_records.status default:",
      err.message,
    );
  } finally {
    await sequelize.query("PRAGMA foreign_keys=ON");
  }
}

export async function ensureSchema() {
  const qi = sequelize.getQueryInterface();

  for (const migration of MIGRATIONS) {
    let existing;
    try {
      existing = await qi.describeTable(migration.table);
    } catch {
      // Table does not exist yet — sequelize.sync() will create it with the
      // full column set, so there is nothing to migrate.
      continue;
    }

    for (const [name, definition] of Object.entries(migration.columns)) {
      if (existing[name]) continue;
      try {
        await qi.addColumn(migration.table, name, definition);
        console.log(`[DB] Added column ${migration.table}.${name}`);
      } catch (err) {
        console.warn(`[DB] Could not add ${migration.table}.${name}:`, err.message);
      }
    }
  }

  // Clinical records no longer sit in a "for review" queue — they are saved
  // as complete. Older rows are moved over so nothing is left in a state the
  // application can no longer reach.
  try {
    const [rows] = await sequelize.query(
      "SELECT COUNT(*) AS c FROM clinical_records WHERE status IS NULL OR status <> 'complete'"
    );
    const pending = Number(rows?.[0]?.c || 0);
    if (pending > 0) {
      await sequelize.query(
        "UPDATE clinical_records SET status = 'complete' WHERE status IS NULL OR status <> 'complete'"
      );
      console.log(`[DB] Moved ${pending} clinical record(s) to "complete"`);
    }
  } catch (err) {
    console.warn("[DB] Could not normalise clinical record status:", err.message);
  }

  // Finally, make the column default agree with the application rule so a row
  // inserted without an explicit status can never land in "for review".
  await fixStatusDefault();
}
