# Conduit - Claude API Gateway with Analytics

A transparent, edge-first API gateway for Claude AI with built-in usage analytics, rate limiting, and beautiful dashboards.

## Features

- **Transparent Proxy**: Forwards any Claude API request without wrapping or modifying the API
- **Edge Runtime**: Global distribution with Vercel Edge for ultra-low latency
- **Rate Limiting**: Per-minute and per-day limits enforced at the edge with Vercel KV
- **Quota Management**: Token-based quotas with real-time tracking
- **Usage Analytics**: Detailed logging with cost tracking and model breakdowns
- **No User Auth**: Users view usage by searching with their API key (no login required)
- **Admin Dashboard**: Full control over API keys, quotas, and analytics
- **Streaming Support**: SSE streaming responses with real-time token extraction

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

Create `.env.local`:

```env
DATABASE_URL=postgresql://...neon.tech/conduit?sslmode=require
KV_REST_API_URL=https://....kv.vercel-storage.com
KV_REST_API_TOKEN=xxx
NEXTAUTH_SECRET=your-secret-32-chars
NEXTAUTH_URL=http://localhost:3000
API_KEY_ENCRYPTION_KEY=your-256-bit-hex-key
CLAUDE_API_KEY=sk-ant-your-key-here
```

### 3. Set Up Database

```bash
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Usage

### Admin: Create API Keys

1. Go to http://localhost:3000/admin/keys
2. Click "Create New Key"
3. Enter your Claude API key and set limits
4. Copy the generated key (shown once)

### Users: View Usage

1. Go to http://localhost:3000/usage
2. Enter your API key
3. View usage stats and remaining quota

### Make API Requests

```bash
curl -X POST http://localhost:3000/api/claude/v1/messages \
  -H "Authorization: Bearer sk-cond_xxx" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Tech Stack

- Next.js 16 + TypeScript
- Neon PostgreSQL
- Vercel KV (Redis)
- Drizzle ORM
- Tailwind CSS

## Project Structure

```
src/
├── app/
│   ├── (public)/usage/          # User dashboard
│   ├── (admin)/admin/           # Admin dashboard
│   ├── api/
│   │   ├── claude/[...path]/    # Main proxy
│   │   ├── admin/keys/          # Key management
│   │   └── usage/               # Usage API
│   └── page.tsx                 # Landing
├── lib/
│   ├── auth/                    # API key validation
│   ├── proxy/                   # Proxy & streaming
│   ├── rate-limit/              # Rate limiting
│   ├── analytics/               # Usage tracking
│   └── db/                      # Database
└── types/                       # TypeScript types
```

## Deployment

### Vercel (Recommended)

```bash
vercel
```

Set up Neon PostgreSQL and Vercel KV in Vercel Dashboard > Storage.

## Security Notes

⚠️ **For Production:**

1. Add authentication to admin routes (NextAuth.js)
2. Rotate encryption keys regularly
3. Never log full API keys
4. Enable monitoring and alerts
5. Use SSL everywhere

## License

MIT
