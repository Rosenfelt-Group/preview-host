# preview-host
Sandboxed prototype preview host for Rosably Engagement Rooms (preview.rosably.com).
A tiny Next.js 16 app deployed as its own Vercel project; it has no UI and holds no user sessions.
It serves prototype files only when the request carries a valid signed grant (HMAC, expiring).
Every response gets a strict CSP (no network from the prototype, framing limited to known ancestors).
HTML responses get a small bridge script injected that reports the visible screen to the parent frame.
Env vars: ROOM_GRANT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FRAME_ANCESTORS (space-separated origins).
