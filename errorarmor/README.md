# ErrorArmor

**Scan Deep. Detect Errors. Fix with Confidence.**
A full-stack error-detection platform: React + Vite + Tailwind frontend, Node/Express REST API, MongoDB (Mongoose).

Everything lives in this one folder:

```
errorarmor/
  package.json        root scripts
  client/             React app (Vite, Tailwind, Recharts, React Router)
  server/             Express API, scanners, tests
  docs/               API reference, security notes, troubleshooting
```

## Quick start

Requirements: Node.js 20+ and a running MongoDB (local, Docker, or Atlas).

```bash
npm run install:all

cp server/.env.example server/.env      # set MONGODB_URI and JWT_SECRET
cp client/.env.example client/.env      # can stay empty in development

npm run dev:server     # terminal 1 -> http://localhost:5000
npm run dev:client     # terminal 2 -> http://localhost:5173
```

MongoDB via Docker: `docker run -d -p 27017:27017 --name mongo mongo:7`

Open http://localhost:5173, create an account, then **New scan** and upload a ZIP (or pick a folder).

## Tests

```bash
npm test
```
Covers the scanning pipeline (syntax, API route/method mismatch, logic, config, dependencies, secret redaction), archive path safety and ZIP extraction.

## What it really does

| Area | Implemented |
|---|---|
| Syntax | JS/JSX (acorn), JSON, Python (`ast.parse` in a child process, parse only) |
| Logic | Assignment in conditions, `=== NaN`, bad `typeof`, off-by-one loops, `async` in `forEach`, `.map` without return, unreachable code |
| API | Express route extraction (incl. nested `app.use` mounts) vs frontend `fetch`/`axios` calls: route mismatch, method mismatch, missing error handling, hard-coded localhost, CORS, unused endpoints |
| Config | Env vars vs `.env.example`, Vite `VITE_` prefix, committed `.env`, `.gitignore`, `package.json` sanity |
| Dependencies | Imported-but-undeclared, declared-but-unused, unpinned versions |
| Security | Secrets (always masked), eval, shell/SQL/NoSQL injection patterns, path traversal, raw HTML, JWT fallback secret |
| Platform | Auth (bcrypt + httpOnly JWT cookie), ownership checks, upload limits, background queue, live progress (polling), history, compare, JSON/HTML export, retention, account deletion |

### Honest limitations (reported as "skipped" in the UI, never faked)
- **Test execution** is not enabled. Running uploaded code needs a container/VM sandbox. `server/src/scanners/testRunner.js` documents where to plug one in.
- **TypeScript** compiler checks, **response-field/request-body contract** analysis and **known-vulnerability** lookups are not implemented.
- **AI explanations**: no external provider is connected. Explanations are rule-based; the AI preference is stored for future use.
- **PDF export** is not implemented (JSON and HTML are). Use the browser's *Print to PDF* on the HTML report.
- **Local scanning agent** is not implemented; browsers zip a chosen folder before upload.
- Scans run in-process in a background queue (`server/src/queue/jobQueue.js` is an interface you can replace with BullMQ etc.). Scanners only read text and never execute uploaded code, but for hostile multi-tenant use run them in separate worker containers.
- `bcryptjs` is used instead of native `bcrypt` (same algorithm, no native build step).

## Deployment
1. `npm run build` -> serve `client/dist` from any static host; set `VITE_API_URL=https://api.yourdomain.com/api` before building.
2. Run the API with `NODE_ENV=production`, a strong `JWT_SECRET`, `CLIENT_ORIGIN=https://your-frontend`, a managed MongoDB `MONGODB_URI`, and a persistent volume for `STORAGE_DIR`.
3. Serve both over HTTPS (cookies are `secure` in production). If frontend and API are on different sites, change the cookie `sameSite` to `none` in `server/src/middleware/auth.js`.

See `docs/API.md`, `docs/SECURITY.md`, `docs/TROUBLESHOOTING.md`.
