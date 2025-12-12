# Doctor Booking System

Single-page frontend + simple Express + SQLite backend for a Doctor Appointment Booking demo.

## Repo layout
- `frontend/` — static SPA (index.html, styles.css, app.js) — demo using localStorage
- `backend/` — Node.js + Express + better-sqlite3 server
- `docker-compose.yml` — run with Docker
- `Dockerfile.backend` — backend image

---

## Run frontend (static)
Open `frontend/index.html` in your browser (works offline). Or deploy with GitHub Pages (instructions below).

---

## Run backend (local, Node)
> **Note:** On Windows `better-sqlite3` may require matching Node LTS and build tools. If you run into build errors, see "Troubleshooting" below.

1. Install Node (recommended Node 18 LTS). Using nvm is helpful.

2. Install dependencies
```bash
cd backend
npm install
npm run init-db     # creates data.db with sample data
npm start
