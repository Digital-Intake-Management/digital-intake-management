# CareLink of Georgia — Digital Intake Management Platform

CS 4850 Senior Capstone | Spring 2026 | Team 28-T2  
**Sponsor:** CareLink of Georgia  
**Advisor:** Sharon Perry

---

## Team & Ownership

| Name | Role | Owns |
|---|---|---|
| Anthony Tran | Team Lead / Developer | Backend architecture, API routes, PDF service, auth |
| Dennise Gonzalez | Developer | Frontend pages (intake workflow, form completion) |
| Success Ogunniwa | Tester | Backend testing, admin routes, reports |
| Mekdilawit (Meya) Asefa | Frontend / Docs | Frontend pages (dashboard, admin), component library |
| Sydney Forbes | Backend / Docs | Auth routes, patient routes, API docs |

---

## What This App Does

CareLink of Georgia currently handles patient intake paperwork manually (paper → scan → upload to MethaSoft). This platform replaces that workflow with a web application where counselors and patients fill out and sign forms digitally, which are then exported as PDFs and stored in a secure SharePoint folder. The counselor then manually links the documents in MethaSoft's Document Manager.

**The app does NOT replace MethaSoft.** It sits alongside it.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Fast, type-safe, matches prototype |
| Styling | Tailwind CSS | Utility-first, matches CareLink color scheme |
| Routing | React Router v6 | Industry standard |
| Forms | react-hook-form | Validation + performance |
| Charts | Recharts | Admin dashboard weekly activity chart |
| PDF generation | pdf-lib | Flatten form fields + signatures into PDF |
| Signatures | signature_pad | Canvas-based touch/mouse signature capture |
| Backend | Node.js + Express + TypeScript | Team familiar, consistent with frontend |
| Database | PostgreSQL + Prisma ORM | Relational, type-safe, great tooling |
| Auth | JWT (jsonwebtoken) | Stateless, simple shift-based sessions |
| Email | Nodemailer + node-cron | Weekly reports, no paid API needed |
| Validation | Zod | Runtime type validation on all API inputs |

---

## Prerequisites

Before you can run this project, install:

1. **Node.js v20+** — https://nodejs.org  
   Verify: `node --version` should show `v20.x.x` or higher

2. **PostgreSQL** — https://www.postgresql.org/download  
   Or use [Postgres.app](https://postgresapp.com/) on Mac  
   Verify: `psql --version`

3. **Git** — https://git-scm.com  
   Verify: `git --version`

---

## Getting Started (First Time Setup)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_ORG/carelink-digital-platform.git
cd carelink-digital-platform
```

### 2. Create the database

Open your terminal and run:
```bash
psql -U postgres
```
Then inside psql:
```sql
CREATE DATABASE carelink_db;
\q
```

### 3. Set up environment variables

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/carelink_db
JWT_SECRET=paste_a_long_random_string_here
```

To generate a secure JWT secret, run:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Install all dependencies

From the **root** of the project:
```bash
npm install
```

### 5. Set up the database schema and seed data

```bash
cd backend
npm run db:migrate    # Creates all tables
npm run db:generate   # Generates the Prisma client
npm run db:seed       # Seeds admin user + 6 default form templates
```

You should see:
```
✅ Admin user created: admin
✅ Counselor user created: counselor1
✅ Form template: Assessment Disclosure
... (6 forms)
✅ System config seeded

Default credentials:
  Admin     → username: admin       / password: admin123
  Counselor → username: counselor1  / password: counselor123
```

### 6. Run the app

From the **root** of the project:
```bash
npm run dev
```

This starts both servers simultaneously:
- **Frontend:** http://localhost:5173
- **Backend:**  http://localhost:3001
- **Health check:** http://localhost:3001/health

---

## Project Structure

```
carelink-digital-platform/
├── frontend/                     # React + TypeScript + Vite
│   └── src/
│       ├── components/
│       │   ├── common/           # ProtectedRoute
│       │   ├── forms/            # SignaturePad, FormField (TODO)
│       │   └── layout/           # AppLayout (sidebar + topbar)
│       ├── hooks/
│       │   └── useAuth.tsx       # Auth context + login/logout
│       ├── pages/                # One file per screen (see routes below)
│       ├── services/
│       │   └── api.ts            # Axios instance + typed API helpers
│       ├── styles/
│       │   └── globals.css       # Tailwind + reusable component classes
│       ├── types/
│       │   └── index.ts          # All shared TypeScript interfaces
│       └── App.tsx               # Route definitions
│
├── backend/                      # Node.js + Express + TypeScript
│   ├── prisma/
│   │   ├── schema.prisma         # DATABASE SCHEMA — source of truth
│   │   └── seed.ts               # Seeds admin user + form templates
│   └── src/
│       ├── app.ts                # Express entry point
│       ├── config/
│       │   └── database.ts       # Prisma singleton
│       ├── middleware/
│       │   ├── authenticate.ts   # JWT verification
│       │   ├── requireAdmin.ts   # Admin-only routes
│       │   ├── validate.ts       # Zod schema validation
│       │   ├── errorHandler.ts   # Global error handler
│       │   └── requestLogger.ts  # Request logging
│       ├── routes/
│       │   ├── auth.ts           # POST /api/auth/login
│       │   ├── patients.ts       # Patient ID CRUD
│       │   ├── sessions.ts       # Intake session lifecycle
│       │   ├── forms.ts          # Form template read
│       │   ├── admin.ts          # Admin-only operations
│       │   └── reports.ts        # Weekly report generation
│       └── services/
│           └── reportScheduler.ts # Cron job — weekly email report
│
└── docs/                         # Mekdilawit + Sydney own this
```

---

## API Contract

These are the API endpoints the frontend calls. The backend team builds these; the frontend team consumes them. **Both sides agreed on this contract before building.**

| Method | Endpoint | Who calls it | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | LoginPage | Returns JWT token |
| GET | `/api/patients/:id` | PatientVerificationPage | Verify patient ID exists |
| POST | `/api/patients` | PatientVerificationPage | Create new patient ID |
| GET | `/api/patients` | AdminPatientsPage | List all patients (admin) |
| DELETE | `/api/patients/:id` | AdminPatientsPage | Delete patient ID (admin) |
| GET | `/api/sessions` | DashboardPage | List all sessions |
| GET | `/api/sessions/:id` | IntakeWorkflowPage | Get session + forms |
| POST | `/api/sessions` | PatientConfirmPage | Create new session |
| PATCH | `/api/sessions/:id/forms/:formId/fields` | FormCompletionPage | Auto-save form fields |
| PATCH | `/api/sessions/:id/forms/:formId/complete` | FormCompletionPage | Mark form complete |
| POST | `/api/sessions/:id/export` | DocumentExportPage | Record PDF export |
| POST | `/api/sessions/:id/confirm-methasoft` | MethaSoftLinkPage | Complete session |
| GET | `/api/forms` | PatientConfirmPage | List form templates |
| GET | `/api/admin/stats` | AdminDashboardPage | Weekly chart data |
| GET | `/api/admin/config` | AdminSettingsPage | Get system config |
| PATCH | `/api/admin/config/:key` | AdminSettingsPage | Update config value |
| POST | `/api/admin/forms` | AdminFormsPage | Create form template |
| PATCH | `/api/admin/forms/:id` | AdminFormsPage | Edit form template |
| DELETE | `/api/admin/forms/:id` | AdminFormsPage | Deactivate form template |
| GET | `/api/reports/weekly` | AdminDashboardPage | Weekly report JSON |
| GET | `/api/reports/weekly/csv` | AdminDashboardPage | Download CSV |

---

## Page → Route Map

| Screen (from prototype) | Route | Owner |
|---|---|---|
| Login | `/login` | Meya / Dennise |
| Counselor Dashboard | `/dashboard` | Dennise / Meya |
| Patient ID Verification | `/intake/new` | Dennise / Meya |
| Patient Confirm | `/intake/new/confirm` | Dennise / Meya |
| Intake Workflow (step tracker) | `/intake/:sessionId` | Dennise / Meya |
| Form Selection | `/intake/:sessionId/forms` | Dennise / Meya |
| Form Completion (+ signatures) | `/intake/:sessionId/forms/:formId` | Dennise / Meya + Anthony |
| Document Export | `/intake/:sessionId/export` | Anthony |
| MethaSoft Link instructions | `/intake/:sessionId/methasoft` | Dennise / Meya |
| Intake Complete summary | `/intake/:sessionId/complete` | Dennise / Meya |
| Admin Dashboard | `/admin` | Success / Anthony |
| Admin Patient Management | `/admin/patients` | Success / Anthony |
| Admin Form Templates | `/admin/forms` | Success / Anthony |
| Admin Settings | `/admin/settings` | Success / Anthony |

---

## Git Workflow

We use GitHub with the following branch strategy:

```
main          ← production-ready code only; tagged at each milestone
dev           ← integration branch; merge features here first
feat/NAME     ← individual features (branch from dev)
bugfix/NAME   ← bug fixes (branch from dev)
hotfix/NAME   ← critical fixes to main only
```

**Day-to-day workflow:**
```bash
# Start a new feature
git checkout dev
git pull origin dev
git checkout -b feat/your-feature-name

# Work... commit often
git add .
git commit -m "feat: describe what you did"

# Push and open a Pull Request to dev
git push origin feat/your-feature-name
```

**Rules:**
- Never push directly to `main` or `dev`
- All PRs need at least one review before merging
- Link your PR to the relevant GitHub Issue

---

## Key Design Decisions

### No demographic storage
Per the sponsor spec: the app stores **only the Patient ID string** (e.g. `PT-12345`). No names, DOB, gender, phone, or insurance data are stored in our database. That information lives in MethaSoft and appears only on the filled-out PDF forms.

### Signatures embedded in PDFs (no separate step)
Signature capture happens **within** each form's completion screen, not as a separate step. The `signature_pad` library captures the drawing on a canvas. When the form is submitted, `pdf-lib` flattens the canvas image directly onto the correct position on the PDF page. This matches the real-world paper form experience.

### Temporary field values deleted on completion
Per the spec: when the counselor confirms MethaSoft linking, **all form field values are deleted** from our database. The PDF in SharePoint becomes the permanent record. Our DB retains only status and immutable audit logs.

### No direct MethaSoft integration
The app does NOT connect to MethaSoft's API. The counselor manually opens MethaSoft and links the PDF file. Our app provides step-by-step instructions and requires confirmation before marking a session complete.

---

## Milestone Checklist

### Milestone 1 — Requirements & Workflow (Done)
- [x] Requirements document
- [x] Intake workflow diagrams
- [x] Form inventory and field definitions
- [x] Database schema
- [x] API contract defined
- [ ] Sponsor sign-off

### Milestone 2 — Core Application
- [ ] Login + auth working end-to-end
- [ ] Patient verification flow
- [ ] Form selection and completion
- [ ] Signature capture embedded in forms
- [ ] PDF generation and SharePoint export
- [ ] MethaSoft linking confirmation
- [ ] Counselor dashboard with session list

### Milestone 3 — Admin, Reports, Hardening
- [ ] Admin dashboard with weekly chart
- [ ] Admin patient management (add/delete)
- [ ] Admin form template editor
- [ ] Admin system settings (SharePoint path, email)
- [ ] Weekly email report (automated + CSV download)
- [ ] Error handling throughout
- [ ] User documentation
- [ ] Developer setup documentation
- [ ] Final demo walkthrough

---

## Useful Commands

```bash
# Run everything (frontend + backend)
npm run dev

# Run just backend
cd backend && npm run dev

# Run just frontend
cd frontend && npm run dev

# Open Prisma Studio (visual DB browser)
cd backend && npm run db:studio

# Re-run seed (if you need to reset form templates)
cd backend && npm run db:seed

# Type-check frontend without building
cd frontend && npm run type-check

# Run backend tests
cd backend && npm test
```

---

## Questions?

- **Architecture / backend:** Anthony Tran
- **Frontend / UI:** Dennise Gonzalez, Mekdilawit Asefa  
- **Testing:** Success Ogunniwa  
- **Docs:** Sydney Forbes, Mekdilawit Asefa  
- **Sponsor contact:** Ricki @ CareLink of Georgia — 678-903-5103
