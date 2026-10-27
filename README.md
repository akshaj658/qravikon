# Qravikon

**Ideas deserve evidence.**

Qravikon is a startup-validation workspace that helps founders examine an idea through an eight-stage workflow: idea clarification, problem viability, target customers, market sizing, competitor research, differentiation, go-to-market planning, and a final report.

## Features

- An authenticated project workspace with saved project and workflow progress.
- Eight stages with generated findings, approval and revision actions, and a final report.
- Project-specific Copilot conversations.
- A public, interactive SmartStock AI demo at `/project/demo`. Demo decisions and chat remain temporary in browser memory and do not write to project tables.
- A public landing page at `/` and `/dashboard`, with project management at `/projects`.

## Technology

- **Web:** React 18, Vite, TypeScript, Tailwind CSS, React Router
- **API:** Node.js, Express, TypeScript, Zod, OpenAI SDK
- **Auth and database:** Supabase Auth and PostgreSQL with Row Level Security (RLS)
- **AI and research:** OpenAI-compatible model endpoints and optional Tavily web research

The browser uses the Supabase public anon/publishable key for Auth and any direct client operations. The API verifies bearer tokens and checks project ownership; its Supabase service-role key is server-only.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- A Supabase project for sign-up, authenticated projects, and persistence
- Optional: an AI provider credential for generated workflow findings and Copilot on real projects
- Optional: a Tavily credential for live web research

The public landing page and interactive demo can be explored without configuring Supabase, AI, or Tavily.

## Install and configure

From the repository root:

```bash
npm ci
cp -n apps/api/.env.example apps/api/.env
cp -n apps/web/.env.example apps/web/.env.local
```

Fill in the local environment files as needed:

### Backend: `apps/api/.env`

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public Supabase key used by the API to verify user tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by trusted API operations; never expose or prefix with `VITE_` |
| `AI_PROVIDER` | Provider label supported by the API (`openai`, `anthropic`, `groq`, `together`, or `google`) |
| `AI_API_KEY` | Optional provider credential, used only by the API |
| `AI_MODEL` | Model identifier for the selected provider |
| `AI_BASE_URL` | Optional endpoint for a compatible provider |
| `AI_FALLBACK_MODEL` | Optional fallback model for quota exhaustion |
| `TAVILY_API_KEY` | Optional key for live research |
| `PORT` | API listening port; defaults to `4000` |
| `NODE_ENV` | Runtime environment |
| `CLIENT_URL` | Allowed web origin for CORS |

### Frontend: `apps/web/.env.local`

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon/publishable key; Vite variables are bundled into browser code |
| `VITE_API_URL` | API base URL, such as `http://localhost:4000` |

Only public values belong in `VITE_` variables. The root `.env.example` is a reference; the workspace commands load the package-specific files above.

## Supabase setup

1. Create a Supabase project and configure its Auth email and redirect settings.
2. Apply `supabase/migrations/001_initial.sql` using the Supabase SQL Editor.
3. Apply `supabase/migrations/002_copilot_conversations.sql` after the initial schema migration.
4. Configure the local and deployed web URL in Supabase Auth URL Configuration, including the `/auth/reset-password` redirect.
5. Add the Supabase URL and keys to the backend and frontend environment files as documented above.

Migrations are SQL files in the repository; they are not run automatically by the application. Review them and confirm the applied state before applying them to an existing database.

## Development and checks

```bash
# Start the API and web app
npm run dev

# Or start separately
npm run dev:api
npm run dev:web

# Run all API and web unit tests
npm test

# Type-check both workspaces
npm run type-check

# Lint the web workspace
npm run lint

# Build API and web for production
npm run build
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:4000`. The API health check is at `/health`.

## Interactive demo

Start the app and open `http://localhost:5173/project/demo` (or use the demo link on the landing page). The demo includes the sample SmartStock AI project, all eight workflow stages, temporary approval/revision/skip decisions, and a contextual deterministic Copilot fallback. Its state resets when the demo is reset or the page is reloaded; it is separate from authenticated project and conversation persistence.

## Deployment

Build from the repository root so npm can use the workspace lockfile:

- **Web on Vercel:** use the repository root as the project root so Vercel can access the npm workspace lockfile. The root `vercel.json` builds the web workspace, serves `apps/web/dist`, and rewrites frontend routes to the Vite entry point so direct navigation and refresh work. Configure the `VITE_` variables at build time.
- **API:** install with `npm ci`, build with `npm run build:api`, then start with `npm run start -w apps/api`. Configure the backend variables and set `CLIENT_URL` to the deployed web origin.
- Configure the production web URL and password-reset redirect in Supabase Auth. Apply and verify database migrations separately.

Use the deployment platform's supported Node.js version (22 or newer) and keep backend credentials in its server-side secret store.

## Security and project status

- Never commit populated `.env` files, API keys, database passwords, JWT secrets, or service-role credentials. `.gitignore` does not remove a secret from Git history.
- If a credential was ever committed or exposed, revoke/rotate it with its provider and review repository history before publishing.
- The demo is public and temporary; it does not persist its decisions or messages to Supabase.
- No license file is included. Choose and add a license only after deciding the intended terms for the project.
