# QR-MedSecure API

Express + Sequelize backend for QR-MedSecure. The React app (`../src`) reads
and writes **only** this server — there is no mock/offline data layer in the
frontend any more. If the API is unreachable, screens show a "cannot reach the
server" state with a retry action.

## Run it

```powershell
cd server
npm install
node src/app.js          # http://localhost:5000/api
```

Configuration lives in `.env` (copied from `.env.example`). Defaults use
**SQLite** (`data/offline.db`) so local development needs no external database
— `sequelize.sync()` creates any missing tables on boot. To use **MySQL**
instead, set:

```
DB_DIALECT=mysql
DB_HOST=... DB_PORT=3306 DB_USER=... DB_PASS=... DB_NAME=qr_medsecure
```

> ⚠️ Change `JWT_SECRET`, `JWT_REFRESH_SECRET` and `QR_ENCRYPTION_KEY` before
> any real deployment — the committed values are dev placeholders.

## Seeded accounts

Created by `scripts/seed.js` (run once against a fresh/reset database):

| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin@123 | Secretary (Admin) |
| roberto.manalo@example.com | Demo@1234 | Chairman |
| maria.santos@example.com | Demo@1234 | BHW |
| elena.villanueva@example.com | Demo@1234 | BHW |
| jose.ramos@example.com | Demo@1234 | Doctor |

New staff sign up via `POST /api/auth/register`, which creates a **pending
request**; the admin approves it from *User & role management* (`POST
/admin/users/requests/:id/review`), after which the account can sign in.

## Security model

- **JWT** access (1 h) + refresh (7 d) tokens, verified by `middleware/auth.js`;
  the frontend refreshes transparently on a 401.
- **Role guards** normalize display roles ("Secretary (Admin)") to slugs so
  `requireRole("secretary")` matches regardless of formatting.
- **QR codes** are AES-256-GCM encrypted payloads (`utils/crypto.js`) with a
  10-minute expiry and are **single-use rows**: a token moves `active → used`
  on first validation; replay returns 409, tampered/forged payloads fail tag
  verification and return 400.
- Passwords stored as **bcrypt** hashes (cost 12); invites return a one-time
  temporary password that is never stored in plain text.
- Privileged actions (approve/reject, suspend, role change, invite) append to
  the `audit_log` table, readable at `GET /api/admin/audit`.

## Data model

All tables hold real data — no fixture/demo fallbacks exist:

`users`, `user_prefs`, `requests`, `beneficiaries`, `clinical_records`,
`prescriptions`, `transactions`, `medicines`, `machines`, `machine_events`,
`qr_tokens`, `notifications`, `sync_batches`, `audit_log`.

## Maintenance scripts

```powershell
node scripts/seed.js        # populate a fresh DB (staff, formulary, records…)
node scripts/reset-demo.js  # drop every table (run seed.js afterwards)
```

Typical clean-slate sequence:

```powershell
node scripts/reset-demo.js
node scripts/seed.js
```

## Endpoints

All under `/api`, all requiring `Authorization: Bearer <token>` unless marked
public. Read `src/routes/*.js` for the authoritative list; highlights:

| Method | Path | Roles |
|---|---|---|
| POST | `/auth/login` | public |
| POST | `/auth/register` | public (creates pending request) |
| GET | `/auth/requests/:id?email=` | public (own request status) |
| POST | `/auth/refresh` | public |
| GET | `/auth/me` | any |
| GET · PUT | `/users/me` · `/users/me/password` · `/users/me/notification-preferences` | any |
| GET | `/dashboard` | admin/secretary |
| GET | `/bhw/dashboard` · `/bhw/worklist` | bhw |
| GET · POST · PUT | `/beneficiaries[/:id]` · `/beneficiaries/:id/records` | staff (writes: admin/secretary) |
| GET · POST · PUT | `/clinical-records[/:id]` | staff (writes: bhw/admin/secretary) |
| GET · POST | `/transactions[/:id]` · `/transactions/:id/void` | staff (writes: health roles; void: admin/secretary) |
| GET · POST · PUT | `/inventory[/:id]` · `/inventory/restock` · `/medicines` | health roles |
| GET · POST · PUT | `/machine[/:id]` · `/machine/:id/events` | staff (writes: health roles) |
| GET · POST · PUT | `/prescriptions[/:id]` · `/prescriptions/active/:beneficiaryId` | staff (writes: health roles) |
| POST | `/qr/issue/:beneficiaryId` · `/qr/generate/:beneficiaryId` · `/qr/validate` · `/qr/revoke/:token` | issuers |
| GET | `/notifications` · POST `/notifications/:id/read` · `/notifications/read-all` | any (role-scoped) |
| GET | `/alerts/:id` · POST `/alerts/:id/acknowledge` | staff |
| GET | `/sync/status` · `/sync/history[/:batchId]` · `/sync/history/export.csv` · POST `/sync/run` | staff |
| GET · POST | `/admin/stats` · `/admin/users` · `/admin/users/requests[...]` · `/admin/users/invite` · PUT `/admin/users/:id/role` · `/admin/audit` · `/admin/beneficiary-ids` | admin/secretary |
| GET | `/chairman/dashboard` · `/chairman/reports[/preview/:period]` · `/chairman/sync/status` · `/chairman/sync/history[/:batchId]` | chairman/admin/secretary |
| GET | `/reports` · `/reports/export.csv` | admin/secretary/chairman |
