# BetMatch

Full-stack peer-to-peer sports betting scaffold with:

- `database/schema.sql` for PostgreSQL / Supabase
- `server/` for Node.js + Express + Socket.io
- `client/` for React + Vite + Tailwind + Framer Motion

## Run locally

1. Run `database/schema.sql` in PostgreSQL / Supabase SQL editor.
2. Start the server:

```bash
cd betmatch/server
npm install
npm run dev
```

3. Start the client:

```bash
cd betmatch/client
npm install
npm run dev
```

## Environment

Set the following variables in `betmatch/server/.env`:

```bash
PORT=4000
CLIENT_URL=http://localhost:5173
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=betmatch
JWT_SECRET=replace-me
```

Set the following variables in `betmatch/client/.env` if needed:

```bash
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```
