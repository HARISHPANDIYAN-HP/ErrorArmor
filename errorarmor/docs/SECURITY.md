# Security & privacy notes
- Passwords hashed with bcrypt (cost 12); sessions are httpOnly, SameSite=Lax JWT cookies (Secure in production).
- Every query filters by `owner`; other users' resources return 404.
- Uploads: ZIP magic-number check, size limit, entry-count limit, unzipped-size limit (zip-bomb), zip-slip and absolute-path rejection, symlinks skipped, ignored folders (node_modules, .git, dist, build…), unsupported types skipped, files over 1 MB skipped.
- Uploaded code is only parsed as text. It is never `require`d, imported or run by the server.
- Secrets found in code are redacted before being stored, displayed or exported; exports omit source snippets.
- Rate limiting on API, auth and upload routes; Helmet headers; strict CORS origin; JSON body limit.
- Not covered: sandboxed test execution, multi-tenant worker isolation, virus scanning. Add these before accepting untrusted public uploads.
