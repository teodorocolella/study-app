# Study App

A study companion web app with class folders, spaced-repetition flashcards, markdown notes, and
an AI tutor powered by the Claude API — built for middle school through high school and beyond.

## Features

- **Class folders** — organize notes and flashcard decks by subject/class
- **Flashcards with spaced repetition** — an SM-2 scheduling algorithm resurfaces cards you miss
  sooner and pushes cards you know well further out, so study time stays focused
- **Markdown notes** — a simple notes editor per class folder with a live preview
- **AI tutor (Claude API)**:
  - Generate flashcards automatically from pasted or typed notes
  - Chat with a tutor scoped to a specific class folder's notes
  - Summarize long notes into a quick digest
  - Get an alternate explanation for a flashcard you didn't understand
- **Dashboard** — see what's due for review today across every class, plus study streaks
- **Accounts** — full signup/login so each user's classes, notes, and progress are private and
  isolated from everyone else's

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
