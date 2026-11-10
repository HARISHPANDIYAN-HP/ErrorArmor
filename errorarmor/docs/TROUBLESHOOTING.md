# Troubleshooting
- **`MongooseServerSelectionError`**: MongoDB is not reachable. Start it and check `MONGODB_URI` in `server/.env`.
- **Login works but you are logged out on refresh**: set `CLIENT_ORIGIN` to the exact frontend URL; in production use HTTPS, and `sameSite: 'none'` if the API is on a different site.
- **`Cannot find module 'acorn-jsx'` etc.**: run `npm run install:all`.
- **Upload rejected**: must be a `.zip` under `MAX_UPLOAD_MB`, containing supported source files. Folders are zipped automatically by the browser.
- **Scan stuck on queued after a restart**: interrupted scans are marked failed on start; use *Retry*.
- **Python not checked**: install `python3` on the API host; otherwise the check shows as skipped.
- **CORS error in dev**: leave `VITE_API_URL` empty so Vite proxies `/api` to `localhost:5000`.
