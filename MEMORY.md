# Mudrek Lead Engine — Build Memory Log

> This file tracks what has been built, what is in progress, and what is not yet done.
> Updated by AI assistant. Last updated: 2026-03-27 (Session 4).

---

## Project Overview

**Mudrek Lead Engine** — Arabic RTL internal CRM for Mudrek admins and graduated students.
- Lead intake, assignment, follow-up, status tracking, comments, reminders, WhatsApp notifications.
- Stack: Node.js/Express + Prisma + PostgreSQL (backend) | Next.js Arabic RTL (frontend, not yet built) | Google Sheets (student roster sync) | 2Chat API (WhatsApp).

---

## ✅ DONE

### Backend (`/backend`)
| File / Module | Status | Notes |
|---|---|---|
| `app.js` | ✅ Complete | Express app, all routes mounted, rate limiting, CORS, Helmet |
| `package.json` | ✅ Complete | All dependencies included |
| `.env.example` | ✅ Complete | All env vars documented |
| `prisma/schema.prisma` | ✅ Complete | Full schema: User, Lead, LeadComment, LeadHistory, Reminder, SyncLog |
| `prisma/seed.js` | ✅ Complete | Seed file present |
| `src/config/index.js` | ✅ Complete | Config from env vars |
| `src/utils/logger.js` | ✅ Complete | Winston logger |
| `src/utils/response.js` | ✅ Complete | Standardized API response helpers |
| `src/middleware/auth.middleware.js` | ✅ Complete | JWT auth + role check |
| `src/middleware/validate.middleware.js` | ✅ Complete | Express-validator middleware |
| `src/modules/auth/` | ✅ Complete | Login (JWT), `/me` endpoint |
| `src/modules/users/` | ✅ Complete | CRUD + toggle active |
| `src/modules/leads/` | ✅ Complete | CRUD + atomic claim (transaction) + WhatsApp notification trigger |
| `src/modules/comments/` | ✅ Complete | Add/list comments per lead |
| `src/modules/reminders/` | ✅ Complete | Schedule follow-ups, list due/overdue |
| `src/modules/activity-log/` | ✅ Complete | Chronological audit trail |
| `src/modules/reports/` | ✅ Complete | Dashboard stats, student performance, lost reasons |
| `src/modules/notifications/` | ✅ Complete | 2Chat WhatsApp notification service |
| `src/modules/integrations/google-sheets/` | ✅ Complete | Google Sheets student sync service |
| `src/modules/integrations/twochat/` | ✅ Complete | 2Chat API integration |
| `src/modules/integrations/integrations.routes.js` | ✅ Complete | Manual sync trigger route |
| `src/jobs/sync-students.job.js` | ✅ Complete | Cron: daily 3AM Google Sheets sync |
| `src/jobs/due-reminders.job.js` | ✅ Complete | Cron: overdue reminders flagging |

### Design (Stitch MCP — Project ID: `projects/11311842818354941636`)
| Screen | Status |
|---|---|
| Login - Desktop | ✅ Designed |
| Login - Mobile | ✅ Designed |
| Student Dashboard | ✅ Designed |
| Available Clients (student view) | ✅ Designed |
| My Clients (student view) | ✅ Designed |
| Follow-ups page | ✅ Designed |
| Client Details | ✅ Designed |
| Empty State: Available Leads | ✅ Designed |
| Empty State: No Follow-ups | ✅ Designed |
| Admin Dashboard (Manager Dashboard) | ✅ Designed |
| Client Management - Admin Panel | ✅ Designed |
| Student Management | ✅ Designed |
| Performance Analytics | ✅ Designed |
| Heatmap (Login) | ✅ Designed |

---

## 🔲 NOT YET DONE

### Frontend (`/frontend`) — ✅ BUILT in Session 2
| Task | Status | Notes |
|---|---|---|
| Next.js project scaffold | ✅ Done | Arabic RTL, Tailwind, App Router |
| `package.json`, `tsconfig.json`, `next.config.ts` | ✅ Done | Full setup |
| `tailwind.config.ts` | ✅ Done | Custom teal palette, Arabic fonts |
| `src/styles/globals.css` | ✅ Done | RTL, component classes, Cairo/Manrope fonts |
| `src/utils/auth.ts` | ✅ Done | JWT localStorage helpers |
| `src/utils/cn.ts` | ✅ Done | clsx + tailwind-merge |
| `src/utils/leadStatus.ts` | ✅ Done | Status labels + badge classes |
| `src/context/AuthContext.tsx` | ✅ Done | JWT + role context, login/logout |
| `src/services/api.ts` | ✅ Done | Axios with JWT interceptors + 401 redirect |
| `src/services/auth.ts` | ✅ Done | login, me |
| `src/services/leads.ts` | ✅ Done | leads CRUD, claim, comments, reminders |
| `src/services/students.ts` | ✅ Done | users CRUD, toggleActive, syncFromSheets |
| `src/services/reports.ts` | ✅ Done | dashboard, performance, lostReasons |
| Login page | ✅ Done | RTL form, eye toggle, zod validation, gradient bg |
| Auth layout (redirect guard) | ✅ Done | Redirects to /dashboard if logged in |
| Dashboard layout (sidebar + auth guard) | ✅ Done | RTL sidebar, role-based nav |
| Sidebar component | ✅ Done | Student/Admin nav, active state, user info |
| Student Dashboard | ✅ Done | Stats, quick actions, recent leads |
| Admin Dashboard | ✅ Done | KPIs, student performance table |
| Available Leads / Leads page | ✅ Done | Table, search, filters, claim, admin CRUD |
| Lead Details page | ✅ Done | Timeline, comments, reminders, status update |
| My Leads page | ✅ Done | Student's own leads with search |
| Follow-ups page | ✅ Done | Filter by overdue/today/upcoming |
| Students Management | ✅ Done | Table, toggle active, sync, create |
| Performance Analytics | ✅ Done | KPIs, funnel chart, student ranking, lost reasons |
| Settings page | ✅ Done | Google Sheets, 2Chat, deployment info |
| `LeadFormModal` | ✅ Done | Create/edit lead, status + lost reason |
| `AssignModal` | ✅ Done | Admin assign lead to student |
| `StudentFormModal` | ✅ Done | Create new student account |
| `LeadStatusBadge` | ✅ Done | Status-colored badge |
| `LoadingSpinner`, `EmptyState` | ✅ Done | Shared UI components |
| Activity Log page (admin) | ✅ Done | Session 3 — timeline, pagination, action labels |
| `src/services/activity.ts` | ✅ Done | Session 3 — getLog endpoint |
| `next.config.mjs` | ✅ Done | Session 3 — fixed from .ts (Next.js 14 incompatible) |
| `npm install` | ✅ Done | Session 3 — 405 packages |
| `npm run build` | ✅ Done | Session 3 — all 13 routes compile clean ✅ |

### Session 4 — Admin-configurable settings + full user management
| File | Status | Notes |
|---|---|---|
| `prisma/schema.prisma` | ✅ Updated | Added `SystemSetting` model (key-value, sensitive flag) |
| `src/utils/getSetting.js` | ✅ New | DB-first lookup → env fallback for all integration keys |
| `src/modules/settings/settings.controller.js` | ✅ New | getAll (masked), updateSetting, testTwochat, testSheets |
| `src/modules/settings/settings.routes.js` | ✅ New | GET /, PUT /:key, POST /test/twochat, POST /test/sheets |
| `src/modules/integrations/twochat/twochat.service.js` | ✅ Updated | Reads API key + group ID from DB via getSetting |
| `src/modules/integrations/google-sheets/sheets.service.js` | ✅ Updated | Reads SA JSON + Sheet ID from DB via getSetting |
| `src/modules/users/users.controller.js` | ✅ Updated | Added deleteUser, last-admin guard, role-change guard, ?role filter |
| `src/modules/users/users.routes.js` | ✅ Updated | Added DELETE /:id |
| `app.js` | ✅ Updated | Mounts /api/settings |
| `src/services/settings.ts` | ✅ New | getAll, update, testTwochat, testSheets |
| `src/services/students.ts` | ✅ Updated | delete, ?role filter, update with password |
| `src/app/(dashboard)/settings/page.tsx` | ✅ Rewritten | Editable settings cards per integration, save/test/sync buttons |
| `src/app/(dashboard)/students/page.tsx` | ✅ Rewritten | Tabbed Students/Admins, create/edit/toggle/delete |
| `src/components/students/UserFormModal.tsx` | ✅ New | Replaces StudentFormModal; has role selector (STUDENT/ADMIN) |
| All builds passing | ✅ | 13 routes, no TypeScript errors |

### Infrastructure (Session 3 — Deployment files built)
| Task | Status | Notes |
|---|---|---|
| `ecosystem.config.js` | ✅ Done | PM2: mudrek-backend (4000) + mudrek-frontend (3000) |
| `server/nginx/mudrek.conf` | ✅ Done | HTTP→HTTPS redirect, SSL, /api/ proxy to 4000, / proxy to 3000 |
| `server/deploy.sh` | ✅ Done | Full deploy: git pull → npm install → prisma migrate → build → pm2 reload → nginx reload |
| `.gitignore` / `.gitattributes` | ✅ Done | Excludes .env, node_modules, .next; LF line endings |
| `backend/.env` | ✅ Done | Created with placeholders — **fill in real values before running** |
| `git init` + first commit | ✅ Done | 79 files, commit `03ebe5c` |
| `backend npm install` | ✅ Done | 0 vulnerabilities |
| Backend modules smoke test | ✅ Done | All load OK |

### Still needed (requires real credentials + VPS access)
| Task | Priority | Notes |
|---|---|---|
| Fill `backend/.env` with real values | 🔴 High | DB URL, JWT secret, Google SA JSON, 2Chat key, WhatsApp group ID |
| Create GitHub remote + push | 🔴 High | `git remote add origin <url> && git push -u origin main` |
| VPS: install Node 20, PM2, Postgres, Nginx | 🔴 High | See deploy.sh FIRST_DEPLOY section |
| VPS: create DB + copy .env files | 🔴 High | |
| Run `prisma migrate deploy` on VPS | 🔴 High | Creates all tables |
| Run `server/deploy.sh` first time | 🔴 High | Builds everything and starts PM2 |
| SSL with Certbot | 🟡 Medium | Free SSL for the domain |

---

## Build Sequence (from spec)
- [x] Step 1: Database schema + backend auth
- [x] Step 2: Google Sheets sync for student activation
- [x] Step 3: Lead listing, claim, status updates, comments, reminders
- [x] Step 4: 2Chat WhatsApp notification on lead claim
- [x] Step 5: Admin dashboards, filters, reports, activity log → **Frontend built (Sessions 2–3), build passing ✅**
- [ ] Step 6: VPS deployment with GitHub-based update flow

---

## Design System (Stitch)
- Color: Teal primary `#007A82` / `#00464b`, light surface `#F8F9FA`
- Fonts: Manrope (headlines), Inter (body/labels)
- RTL: Arabic-first layout
- Style: High-end editorial, tonal layering, glassmorphism for modals

---

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/leads` | JWT | List leads (role-filtered) |
| POST | `/api/leads` | Admin | Create lead |
| GET | `/api/leads/:id` | JWT | Lead details |
| PUT | `/api/leads/:id` | JWT | Update lead |
| DELETE | `/api/leads/:id` | Admin | Delete lead |
| POST | `/api/leads/:id/claim` | Student | Claim lead (atomic) |
| POST | `/api/leads/:leadId/comments` | JWT | Add comment |
| GET | `/api/leads/:leadId/comments` | JWT | List comments |
| POST | `/api/leads/:leadId/reminders` | JWT | Create reminder |
| GET | `/api/reminders` | JWT | List reminders |
| GET | `/api/users` | Admin | List users |
| POST | `/api/users` | Admin | Create user |
| PATCH | `/api/users/:id/toggle` | Admin | Enable/disable user |
| GET | `/api/reports/dashboard` | Admin | Dashboard stats |
| GET | `/api/reports/performance` | Admin | Student performance |
| GET | `/api/reports/lost-reasons` | Admin | Lost reason breakdown |
| GET | `/api/activity` | Admin | Activity log |
| POST | `/api/integrations/sync` | Admin | Manual Google Sheets sync |
