# OnePoint Inbox Product Starter

A realistic starter for a unified social inbox with:

- Live updates using Socket.IO
- Local JSON persistence
- User login/register using JWT
- Demo connector toggles
- WhatsApp and Meta webhook placeholders
- Premium React UI with Framer Motion

## Run locally

```bash
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm install
npm run dev
```

Open: http://localhost:5173

Demo login:

```txt
demo@onepoint.app
password123
```

## Real API notes

WhatsApp Cloud API credentials go in `backend/.env`:

```env
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

Meta webhook verification uses:

```env
META_VERIFY_TOKEN=onepoint-demo-token
```

Instagram/Facebook messaging requires Meta-approved permissions, correct professional/page account setup, and webhooks.

## Deploy later

Suggested stack:

- Frontend: Vercel or Netlify
- Backend: Render, Railway, Fly.io, or a VPS
- Database: Postgres / Supabase / Neon
- Real-time: Socket.IO supported backend hosting

This starter uses JSON storage for ease. Replace `backend/src/db.js` with Postgres/Prisma when going production.
