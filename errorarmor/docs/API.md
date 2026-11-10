# API reference

All responses: `{ "success": true, "data": ..., "meta"?: {page,limit,total,pages} }` or `{ "success": false, "error": { "code", "message", "details"? } }`.
Auth uses an httpOnly cookie (`ea_token`); `Authorization: Bearer <token>` also works. All routes except `/api/health` and `/api/auth/register|login|logout` need auth.

| Method & path | Purpose |
|---|---|
| POST `/api/auth/register` `{name,email,password}` | Create account |
| POST `/api/auth/login` `{email,password}` | Log in |
| POST `/api/auth/logout` | Log out |
| GET `/api/auth/me` | Current user |
| GET/PATCH/DELETE `/api/users/me` | Profile, preferences, delete account (`{password}`) |
| POST `/api/projects` (multipart: `name`, `description?`, `archive` ZIP) | Create project from upload |
| GET `/api/projects?q=&page=&limit=` | List projects |
| GET/DELETE `/api/projects/:projectId` | Read / delete project and files |
| POST `/api/projects/:projectId/scans` `{categories?}` (optional multipart `archive` to replace snapshot) | Queue a scan (202) |
| GET `/api/scans?q=&status=&from=&to=&page=` | Scan history |
| GET `/api/scans/compare?base=&head=` | New / resolved findings between scans |
| GET `/api/scans/:scanId` / `/status` / `/summary` | Details, live progress, summary |
| POST `/api/scans/:scanId/cancel` / `/retry` | Cancel / retry |
| DELETE `/api/scans/:scanId` | Delete scan and findings |
| GET `/api/scans/:scanId/findings?severity=&category=&verification=&review=&group=&q=&sort=&page=` | Findings |
| GET `/api/scans/:scanId/report` / `/report/export?format=json\|html` | Report |
| GET `/api/findings/:findingId` | Finding detail |
| PATCH `/api/findings/:findingId/status` `{reviewStatus}` | open / reviewed / false-positive / resolved |
| POST `/api/findings/:findingId/feedback` `{helpful,comment?}` | Feedback |
| POST `/api/findings/:findingId/propose-fix` | Diff proposal (never writes files) |
| POST `/api/findings/:findingId/verify-fix` | Re-run the originating check on the stored snapshot |
| GET `/api/dashboard` | Dashboard statistics |
