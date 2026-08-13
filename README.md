# MailSweep AI

AI-powered Gmail storage management and inbox intelligence platform.

## What it does

- **AI Importance Scoring** — every email gets a 0-100 score. Banking, government, medical, and legal emails are always protected.
- **Storage Forecasting** — linear regression on your growth patterns gives 30/60/90-day predictions.
- **Inbox Health Score** — composite score measuring storage, unread ratio, newsletter load, and spam.
- **AI Cleanup Studio** — what-if preview before deleting anything, 30-day rollback on every session.
- **Subscription Manager** — detect and unsubscribe from newsletters with one click.
- **Smart Rules** — create automated cleanup rules by category, age, or sender.
- **AI Copilot** — Claude-powered chat assistant that knows your inbox data.
- **Weekly Reports** — AI-generated insights and recommendations.

## Stack

**Backend:** Node.js, Express, TypeScript, MongoDB, Google APIs, Anthropic SDK  
**Frontend:** Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion, Recharts

---

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Google Cloud Console project with Gmail API enabled

### 1. Clone / unzip

```bash
cd mailsweep-ai
```

### 2. Run setup script

```bash
node scripts/setup.js
```

This creates `backend/.env` and `frontend/.env.local` with generated secrets.

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or use an existing one)
3. Enable **Gmail API**
4. Create **OAuth 2.0 Client ID** credentials (Web application)
5. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Client Secret into `backend/.env`:

```env
GOOGLE_CLIENT_ID=your_actual_client_id
GOOGLE_CLIENT_SECRET=your_actual_client_secret
```

### 4. (Optional) Add Anthropic API key

Get a key at [console.anthropic.com](https://console.anthropic.com). Add to `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

This enables the AI Copilot and AI-generated weekly reports. Everything else works without it.

### 5. Install dependencies

```bash
npm run install:all
```

### 6. Start MongoDB

```bash
mongod
# or if using MongoDB as a service:
brew services start mongodb/brew/mongodb-community  # macOS
```

### 7. Run

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## Docker

```bash
# Copy and fill in your credentials
cp backend/.env.example backend/.env
# Edit backend/.env with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

docker-compose up
```

---

## Project Structure

```
mailsweep-ai/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app entry
│   │   ├── config/
│   │   │   └── database.ts       # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.ts           # User + OAuth + preferences
│   │   │   ├── AnalysisCache.ts  # 24h analysis cache
│   │   │   ├── CleanupSession.ts # Rollback tracking
│   │   │   ├── StorageSnapshot.ts # Daily storage history
│   │   │   └── WeeklyReport.ts   # AI weekly reports
│   │   ├── services/
│   │   │   ├── gmail.ts          # Gmail API wrapper
│   │   │   ├── importanceScorer.ts # Scoring + forecasting
│   │   │   └── analysisService.ts  # Full inbox analysis
│   │   ├── routes/
│   │   │   ├── auth.ts           # Google OAuth
│   │   │   ├── analysis.ts       # Storage + inbox data
│   │   │   ├── cleanup.ts        # Cleanup + rollback
│   │   │   ├── subscriptions.ts  # Newsletter management
│   │   │   ├── rules.ts          # Smart cleanup rules
│   │   │   ├── insights.ts       # AI copilot + reports
│   │   │   └── settings.ts       # User preferences
│   │   ├── middleware/
│   │   │   ├── auth.ts           # Session auth + token refresh
│   │   │   └── rateLimit.ts      # Rate limiting
│   │   ├── workers/
│   │   │   ├── weeklyReports.ts  # Cron: Sunday 9am
│   │   │   └── storageSnapshots.ts # Cron: every 6h
│   │   └── utils/
│   │       ├── logger.ts         # Winston logger
│   │       └── encryption.ts    # AES-256 token encryption
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Design system
│   │   └── (app)/                # Authenticated app
│   │       ├── layout.tsx        # Sidebar shell
│   │       ├── dashboard/        # Health + storage overview
│   │       ├── inbox/            # Senders + subscriptions
│   │       ├── cleanup/          # AI Cleanup Studio
│   │       ├── storage/          # Storage forecast
│   │       ├── analytics/        # Charts + AI Copilot
│   │       ├── security/         # Protected senders + privacy
│   │       └── settings/         # Preferences + rules
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── HealthScoreGauge.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   └── WeeklyReportCard.tsx
│   │   └── charts/
│   │       └── StorageDonut.tsx
│   ├── lib/
│   │   ├── api.ts                # Axios API client
│   │   ├── utils.ts              # Shared utilities
│   │   └── hooks/
│   │       └── useAuth.ts
│   └── package.json
│
├── scripts/
│   └── setup.js                  # Auto-configure .env files
├── docker-compose.yml
└── package.json                  # Monorepo root
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 5000) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Must match Google Console |
| `SESSION_SECRET` | Yes | Session signing secret |
| `ENCRYPTION_KEY` | Yes | 32-char AES-256 key |
| `FRONTEND_URL` | Yes | For CORS + redirects |
| `ANTHROPIC_API_KEY` | No | Enables AI Copilot + reports |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL |
| `NEXT_PUBLIC_APP_NAME` | App display name |

---

## Security Model

- OAuth tokens are AES-256 encrypted at rest
- No email content is ever stored — only metadata (subject, sender, size, date)
- Analysis cache expires after 24 hours
- Sessions expire after 7 days
- Users can delete all data at any time (Settings → Security)
- Gmail access can be revoked from [Google Account Settings](https://myaccount.google.com/permissions)

---

## Important Email Protection

The following are always excluded from deletion recommendations:

- **Financial:** chase.com, wellsfargo.com, paypal.com, stripe.com, and 10+ others
- **Government:** .gov domains, irs.gov, ssa.gov, state.gov
- **Medical:** mychart.com, athenahealth.com, epic.com
- **Legal:** docusign.com, hellosign.com, legalzoom.com
- **Subject keywords:** tax, invoice, receipt, payment, medical, prescription, legal, contract, insurance, and more
- **Starred emails:** always protected
- **Custom senders:** user-defined list in Security settings

---

## License

MIT
