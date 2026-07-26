# Study Hub

A study companion web app with class folders, spaced-repetition flashcards, markdown notes, and
an AI tutor powered by the Claude API — built for middle school through high school and beyond.

## Features

- **Class folders** — organize notes and flashcard decks by subject/class
- **Flashcards with spaced repetition** — an SM-2 scheduling algorithm resurfaces cards you miss
  sooner and pushes cards you know well further out, so study time stays focused
- **Rich-text notes** — a notes editor per class folder with autosave
- **AI assistant (powered by Claude)** — always available in the corner of every page, synced
  with all of your notes and flashcards:
  - Ask questions about anything you're studying — it answers from your own notes
  - Get quizzed one question at a time, with feedback
  - Ask it to create flashcards or notes for you — it writes them straight into your classes
  - Streams replies live and knows which page you're on
  - Plus: generate flashcards from a note, summarize notes, and "explain differently" during study
- **Practice quizzes** — mixed exercise sets per class: multiple choice, true/false,
  fill-in-the-blank, and short answers graded by Claude with feedback; generate a quiz
  from any note (choosing which types), write questions by hand, or ask the assistant;
  score screen with "retry wrong answers" and attempt history
- **Study sessions** — per-deck review or one "review everything due" session across all
  classes, with keyboard shortcuts (Space to flip, 1–4 to grade) and an end-of-session
  grade breakdown
- **Guided onboarding** — new accounts get an integrated welcome tour that ends by
  creating their first class
- **Messaging & sharing** — message classmates by email and share copies of notes and
  flashcard decks; recipients save them into their own classes. Direct messages and study-group
  chat are live (server-sent events) — messages and typing indicators appear instantly, no
  refresh — and both support optional push notifications for new messages when the app isn't open
- **Email reminders** — an optional daily email nudge when cards are due and you haven't
  studied yet (any SMTP provider)
- **Dashboard** — see what's due for review today across every class, plus study streaks
- **Accounts** — full signup/login, plus optional "Continue with Google / Microsoft" social
  sign-in; each user's classes, notes, and progress are private and isolated from everyone else's
- **More study tools** — a collapsible sidebar, per-grade-level AI recommendations (auto-advancing
  each school year), photos and math (LaTeX) on flashcards, image-occlusion cards, a formula/
  reference library, note diagrams, study games (Match, Speed round, Answer Blocks), and
  multi-person Study Groups with shared notes/decks/quizzes

## Tech stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS, React Router
- **Backend**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL
- **Auth**: JWT access + refresh tokens, bcrypt password hashing
- **AI**: [Anthropic Claude API](https://www.anthropic.com/api) (`@anthropic-ai/sdk`)
- **Deployment**: single Node service (Express serves the built React app) on Render

## Project structure

```
study-app/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/       # route-level pages
│       ├── components/  # reusable UI components
│       ├── context/     # AuthContext
│       ├── hooks/       # useAuth, etc.
│       └── api/         # API client
└── server/          # Node/Express backend
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── routes/       # Express routers
        ├── controllers/  # request handlers
        ├── services/     # auth, Claude API, spaced-repetition orchestration
        ├── middleware/    # auth check, error handling, rate limiting
        └── lib/          # pure/testable logic (SM-2 algorithm)
```

## Local development setup

### Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database (a local instance, or a free hosted dev branch on
  [Neon](https://neon.tech) or similar)
- An [Anthropic API key](https://console.anthropic.com/)

### Steps

```bash
# 1. Install dependencies (installs both workspaces)
npm install

# 2. Configure environment variables
cp .env.example server/.env
# edit server/.env and fill in ANTHROPIC_API_KEY, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Set up the database schema
npx prisma migrate dev --schema=server/prisma/schema.prisma

# 4. Run the app (two terminals)
npm run dev:server   # terminal 1 — API on http://localhost:3001
npm run dev:client   # terminal 2 — frontend on http://localhost:5173
```

Visit `http://localhost:5173` and sign up for an account.

## Environment variables

| Variable              | Description                                                              |
|------------------------|---------------------------------------------------------------------------|
| `ANTHROPIC_API_KEY`   | Your Anthropic API key. Backend-only — never sent to the browser.        |
| `DATABASE_URL`        | Postgres connection string.                                               |
| `JWT_SECRET`          | Long random string used to sign access tokens.                           |
| `JWT_REFRESH_SECRET`  | A **different** long random string used to sign refresh tokens.          |
| `NODE_ENV`            | `development` or `production`.                                           |
| `PORT`                | Port the Express server listens on (defaults to `3001` locally).         |
| `CLIENT_ORIGIN`       | Only needed if client/server are ever split across origins (CORS).       |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Optional. SMTP credentials for daily reminder emails (Gmail app password, Resend, Mailgun…). Leave unset to disable email. |
| `EMAIL_FROM`          | Optional. From address for reminder emails (defaults to `SMTP_USER`).    |
| `APP_URL`             | Public URL of the app, used for links inside reminder emails.            |
| `REMINDER_CRON`       | When the daily reminder job runs (cron syntax, server time). Default `0 16 * * *`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Enables "Continue with Google". Redirect URI: `<APP_URL>/api/auth/oauth/google/callback`. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Optional. Enables "Continue with Microsoft". Redirect URI: `<APP_URL>/api/auth/oauth/microsoft/callback`. |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_URL` / `S3_ENDPOINT` | Optional. S3-compatible object storage (Cloudflare R2, AWS S3) for image uploads. When unset, images are stored inline as data URLs. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Optional. Enables push notifications for new messages. Generate with `npx web-push generate-vapid-keys`. |
| `VITE_GA_MEASUREMENT_ID` | Optional. Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`). Leave unset to disable analytics. Vite bakes this into the build at build time, so it must be set on Render's Web Service *before* the build runs — not just at runtime. |

## Deployment (Render)

This app is designed to deploy as a **single Render Web Service**: Express serves the built
React static bundle in production, so there's only one service, one URL, and one bill.

1. Push this repo to GitHub.
2. On [Render](https://render.com): **New → PostgreSQL** — create a free/starter Postgres
   instance and copy its internal `DATABASE_URL`.
3. **New → Web Service** — connect the GitHub repo, then set:
   - **Build command**: `npm run build`
   - **Start command**: `npm run start`
   - Environment variables: `ANTHROPIC_API_KEY`, `DATABASE_URL` (from step 2), `JWT_SECRET`,
     `JWT_REFRESH_SECRET` (generate both with `openssl rand -base64 48`), `NODE_ENV=production`
4. Deploy. The first deploy runs `prisma migrate deploy`, creating all tables automatically.
5. Visit the assigned `*.onrender.com` URL.

Render's free tier spins down after inactivity (a cold start delay on the next request) — fine
for a beta, worth upgrading to a paid instance once "always on" matters.

## License

MIT — see [LICENSE](LICENSE).

## Credits

This project was built with the assistance of [Claude Code](https://claude.com/claude-code),
Anthropic's agentic coding tool — used for architecture design, scaffolding, implementation, and
iteration throughout development.
