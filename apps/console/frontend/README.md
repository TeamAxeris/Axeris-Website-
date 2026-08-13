# Axeris Frontend — Next.js 14 TypeScript

**Modern, responsive clinical decision support UI** built on Next.js 14, TypeScript, and Tailwind CSS.

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

**UI** available at `http://localhost:3000`

---

## Project Structure

```
frontend/
├── package.json
├── tsconfig.json
├── next.config.js           # API proxy rewrites (localhost:8000 → /api/v1)
├── tailwind.config.ts       # Design system + dark mode config
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout, providers, sidebar
│   │   ├── page.tsx         # Dashboard (home)
│   │   ├── globals.css      # Global styles
│   │   │
│   │   ├── prescriptions/
│   │   │   ├── page.tsx     # Prescription list + filters
│   │   │   └── [id]/page.tsx        # Single Rx detail + copilot
│   │   │
│   │   ├── patients/
│   │   │   ├── page.tsx     # Patient list
│   │   │   └── [id]/page.tsx        # Patient detail + full history
│   │   │
│   │   ├── providers/
│   │   │   ├── page.tsx     # Provider list + risk scoring
│   │   │   └── [id]/page.tsx        # Provider detail + peer comparison
│   │   │
│   │   ├── prior-auth/      # Prior authorization queue
│   │   ├── formulary/       # Formulary tier checker
│   │   ├── interactions/    # Drug interaction network
│   │   ├── analytics/       # Dashboard metrics + trends
│   │   ├── audit/           # ERISA § 404 audit trail
│   │   ├── checks/          # Clinical checks reference (all 24)
│   │   ├── data-sources/    # Integration status panel
│   │   ├── excluded-providers/  # Federal exclusion list search
│   │   ├── settings/        # User preferences + API config
│   │   │
│   │   ├── pba/             # PBA Mode pages
│   │   │   ├── dashboard/
│   │   │   ├── live-transactions/
│   │   │   ├── callbacks/
│   │   │   ├── ncpdp-rejects/
│   │   │   ├── member-safety/
│   │   │   ├── pharmacy-network/
│   │   │   └── formulary-mgmt/
│   │   │
│   │   └── tpa/             # TPA Mode pages
│   │       ├── dashboard/
│   │       ├── pend-queue/
│   │       ├── fraud-referrals/
│   │       ├── asa-disputes/
│   │       ├── stewardship/
│   │       └── employer-reports/
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # Main wrapper: sidebar + header
│   │   │   ├── Sidebar.tsx          # Navigation menu (11 pages)
│   │   │   ├── Header.tsx           # Top bar, user, theme toggle
│   │   │   ├── ModeBar.tsx          # TPA/PBA mode switcher
│   │   │   └── GlobalSearch.tsx     # Rx/patient/provider search
│   │   │
│   │   ├── dashboard/
│   │   │   ├── MetricsCards.tsx     # KPI cards (flags, savings, etc.)
│   │   │   ├── FlagDistribution.tsx # Pie chart: GREEN/YELLOW/RED
│   │   │   ├── PrescriptionFlow.tsx # Bar chart: prescription flow
│   │   │   └── RecentAlerts.tsx     # Recent RED/YELLOW flags
│   │   │
│   │   ├── prescriptions/
│   │   │   ├── FlagBadge.tsx        # Colored badge: GREEN/YELLOW/RED
│   │   │   └── DispositionBadge.tsx # Status badge: APPROVE/REVIEW/FLAG
│   │   │
│   │   ├── ui/
│   │   │   ├── DataTable.tsx        # Reusable table (columns, sorting, filtering)
│   │   │   ├── DetailDrawer.tsx     # Slide-out detail panel
│   │   │   ├── CopilotPanel.tsx     # Floating AI chat widget
│   │   │   ├── CopilotWrapper.tsx   # Context provider for copilot
│   │   │   ├── DataSourceBadge.tsx  # Status badge for FHIR/EDI/NCPDP/etc.
│   │   │   ├── LiveIndicator.tsx    # Pulse animation (PBA real-time)
│   │   │   ├── Skeleton.tsx         # Loading placeholder
│   │   │   ├── ConfirmModal.tsx     # Confirmation dialog
│   │   │   ├── ToastContainer.tsx   # Toast notifications
│   │   │   └── WorkflowDataSources.tsx  # Data source integration panel
│   │   │
│   │   └── auth/
│   │       └── LoginScreen.tsx      # Quick demo login
│   │
│   ├── context/
│   │   ├── AuthContext.tsx          # User state + role (admin, reviewer, analyst)
│   │   ├── ModeContext.tsx          # TPA/PBA operating mode
│   │   ├── ThemeContext.tsx         # Dark mode toggle
│   │   ├── SettingsContext.tsx      # User preferences (localStorage)
│   │   └── ToastContext.tsx         # Notification queue
│   │
│   ├── hooks/
│   │   └── useWebSocket.ts          # Real-time updates (WebSocket)
│   │
│   ├── lib/
│   │   └── api.ts                   # Typed fetch wrapper + error handling
│   │
│   └── types/
│       └── index.ts                 # TypeScript definitions (Prescription, Patient, Flag, etc.)
│
└── public/                          # Static assets
    └── (favicons, images, etc.)
```

---

## 11 Core Pages

| Page | Route | Purpose | Key Components |
|------|-------|---------|-----------------|
| **Dashboard** | `/` | Home; KPI summary + recent alerts | MetricsCards, FlagDistribution, PrescriptionFlow, RecentAlerts |
| **Prescriptions** | `/prescriptions` | Browse all Rx; filter by flag, patient, provider | DataTable, FlagBadge, DispositionBadge |
| **Prescription Detail** | `/prescriptions/{id}` | Full Rx analysis + flags + copilot | DetailDrawer, CopilotPanel |
| **Patients** | `/patients` | Patient roster + risk summary | DataTable |
| **Patient Detail** | `/patients/{id}` | Full profile: diagnoses, allergies, labs, Rx history | DetailDrawer |
| **Providers** | `/providers` | Provider risk scoring + peer comparison | DataTable, Risk metric |
| **Provider Detail** | `/providers/{id}` | Controlled substance volume, outlier score | Charts |
| **Prior Authorization** | `/prior-auth` | PA queue; urgency levels, prescriber contact | DataTable, Workflow |
| **Formulary** | `/formulary` | Tier lookup, alternatives, cost savings | DetailDrawer, Chart |
| **Interactions** | `/interactions` | Drug DDI network visualization | Network graph (D3/Recharts) |
| **Analytics** | `/analytics` | Dashboard metrics, trends, cohort analysis | Charts, time series |
| **Audit Trail** | `/audit` | ERISA § 404 action log (full history) | Timeline, DataTable |
| **Settings** | `/settings` | User preferences, API config, mode selection | Form, toggle |
| **Clinical Checks** | `/checks` | Reference: all 24 checks with evidence | Table with filters |
| **Data Sources** | `/data-sources` | Integration status (FHIR, EDI, NCPDP, etc.) | Status panel |

**PBA Mode Pages** (Real-time, sub-200ms):
- `/pba/dashboard` — Transactions/sec, latency, compliance
- `/pba/live-transactions` — NCPDP D.0 stream
- `/pba/ncpdp-rejects` — NCPDP error codes + pharmacy callbacks
- `/pba/member-safety` — Real-time safety alerts
- `/pba/pharmacy-network` — Pharmacy status + connectivity
- `/pba/formulary-mgmt` — Tier management

**TPA Mode Pages** (Post-adjudication, batch):
- `/tpa/dashboard` — Pend queue, SLA, employer reporting
- `/tpa/pend-queue` — Soft/hard holds, SLA countdown
- `/tpa/fraud-referrals` — Flagged claims for investigation
- `/tpa/asa-disputes` — Appeal/step approval disputes
- `/tpa/stewardship` — ERISA fiduciary decisions
- `/tpa/employer-reports` — Book of business analytics

---

## Component Library

### Layout Components

**AppShell** (`components/layout/AppShell.tsx`)
- Wraps all pages
- Contains Sidebar + Header
- Provides contexts (Auth, Theme, Mode, Settings, Toast)
- Floating CopilotPanel overlay

**Sidebar** (`components/layout/Sidebar.tsx`)
- Navigation menu (11 main pages)
- Mode indicator (TPA/PBA)
- Collapsed/expanded states

**Header** (`components/layout/Header.tsx`)
- Title + breadcrumb
- User profile dropdown
- Dark mode toggle
- Global search box

**ModeBar** (`components/layout/ModeBar.tsx`)
- Quick TPA/PBA mode switch
- Shows active mode + info

**GlobalSearch** (`components/layout/GlobalSearch.tsx`)
- Search bar: Rx, patients, providers
- Autocomplete with instant results

### Dashboard Components

**MetricsCards** (`components/dashboard/MetricsCards.tsx`)
- 6 KPI cards: Total Rx, RED %, SLA compliance, est. savings, avg review time, ERISA audits

**FlagDistribution** (`components/dashboard/FlagDistribution.tsx`)
- Pie chart: GREEN/YELLOW/RED percentages
- Uses Recharts

**PrescriptionFlow** (`components/dashboard/PrescriptionFlow.tsx`)
- Bar chart: prescriptions by status (pending, approved, flagged)
- Trend over 30 days

**RecentAlerts** (`components/dashboard/RecentAlerts.tsx`)
- Table: recent RED/YELLOW flags
- Click to navigate to detail

### Data Components

**DataTable** (`components/ui/DataTable.tsx`)
- Reusable, sortable, filterable table
- Props: `columns`, `data`, `onRowClick`, `loading`
- Pagination + limit selector
- Row highlighting

**DetailDrawer** (`components/ui/DetailDrawer.tsx`)
- Slide-out side panel
- Shows Rx/patient/provider detail
- Flags, actions, metadata
- Close button

**FlagBadge** (`components/prescriptions/FlagBadge.tsx`)
- Colored badge: 🟢 GREEN | 🟡 YELLOW | 🔴 RED
- Risk score tooltip
- Click to detail

**DispositionBadge** (`components/prescriptions/DispositionBadge.tsx`)
- Status badge: APPROVE | REVIEW | FLAG
- SLA countdown (if REVIEW)

**DataSourceBadge** (`components/ui/DataSourceBadge.tsx`)
- Status indicator: ✓ SYNCED | ⏳ SYNCING | ✗ ERROR
- Last sync time

**LiveIndicator** (`components/ui/LiveIndicator.tsx`)
- Pulsing green dot (PBA mode)
- "Transaction processing live" text

### AI Components

**CopilotPanel** (`components/ui/CopilotPanel.tsx`)
- Floating chat widget (bottom-right)
- Messages + input box
- Context-aware (prescription_id, patient_id)
- Typing indicator

**CopilotWrapper** (`components/ui/CopilotWrapper.tsx`)
- Context provider for copilot state
- Manages message history

### Modal & Toast

**ConfirmModal** (`components/ui/ConfirmModal.tsx`)
- Confirmation dialog for actions
- Props: `title`, `message`, `onConfirm`, `onCancel`

**ToastContainer** (`components/ui/ToastContainer.tsx`)
- Toast notifications (success, error, info)
- Auto-dismiss in 4s

---

## Context & State Management

**AuthContext** (`context/AuthContext.tsx`)
```typescript
{
  user: { id, email, role },  // role: admin | reviewer | analyst
  login(email, password),
  logout(),
}
```

**ModeContext** (`context/ModeContext.tsx`)
```typescript
{
  mode: "TPA" | "PBA",
  setMode(mode),
}
```

**ThemeContext** (`context/ThemeContext.tsx`)
```typescript
{
  isDark: boolean,
  toggleDark(),
}
```

**SettingsContext** (`context/SettingsContext.tsx`)
```typescript
{
  settings: { api_url, items_per_page, default_flag_filter, ... },
  saveSetting(key, value),  // Persists to localStorage
}
```

**ToastContext** (`context/ToastContext.tsx`)
```typescript
{
  addToast(message, type),  // type: success | error | info
  removeToast(id),
}
```

---

## Hooks

**useWebSocket** (`hooks/useWebSocket.ts`)
```typescript
const { data, isConnected, lastMessage } = useWebSocket(url);
// Real-time updates: new prescriptions, updated flags, SLA alerts
```

---

## API Integration (`lib/api.ts`)

Typed fetch wrapper with error handling:

```typescript
const api = {
  prescriptions: {
    list(filters) { return fetch('/api/v1/prescriptions?...') },
    get(id) { return fetch('/api/v1/prescriptions/{id}') },
    analyze(body) { return fetch('/api/v1/prescriptions/analyze', { method: 'POST', body }) },
    action(id, action) { return fetch('/api/v1/prescriptions/{id}/action', { method: 'POST', body }) },
  },
  patients: { ... },
  providers: { ... },
  copilot: {
    chat(message, context) { return fetch('/api/v1/copilot/chat', ...) },
    generateNote(type, rx_id) { return fetch('/api/v1/copilot/generate-note?type=...', ...) },
    formularyCheck(drug_id) { return fetch('/api/v1/copilot/formulary-check/{id}', ...) },
    quickQuestions(rx_id) { return fetch('/api/v1/copilot/quick-questions?prescription_id=...', ...) },
  },
  tpa: { dashboard(), pendQueue() },
  pba: { dashboard(), liveTransactions() },
};
```

---

## TypeScript Definitions (`types/index.ts`)

```typescript
interface Prescription {
  id: string;
  patient_id: string;
  drug_id: string;
  provider_id: string;
  dose_mg: number;
  frequency: string;
  days_supply: number;
  date_written: string;
  date_filled: string;
  flag_color: "GREEN" | "YELLOW" | "RED";
  disposition: "APPROVE" | "REVIEW" | "FLAG";
  flags: Flag[];
  risk_score: number;
  processing_time_ms: number;
  notes?: string;
}

interface Flag {
  flag_id: string;
  category: string;
  severity: "critical" | "warning" | "info";
  weight: number;
  title: string;
  description: string;
  evidence_source: string;
  suggested_action: string;
  engine: "rules" | "ml" | "patient";
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  weight_kg: number;
  height_cm: number;
  diagnoses: Diagnosis[];
  allergies: Allergy[];
  lab_results: LabResult[];
  pgx_results: PGxResult[];
  rems_enrollments: REMSEnrollment[];
}

interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  npi: string;
  specialty: string;
  dea_number: string;
  clinic_name: string;
  is_excluded: boolean;
  controlled_volume: number;
  risk_score: number;
}

// ... more types
```

---

## Design System & Theming

**Tailwind Config** (`tailwind.config.ts`):
- Dark mode: `class` strategy
- Color palette: slate, blue, red, yellow, green
- Responsive breakpoints: sm, md, lg, xl, 2xl

**CSS Classes:**
- Buttons: `btn btn-primary`, `btn btn-secondary`, `btn btn-danger`
- Cards: `card card-lg`, `card-hover`
- Badges: `badge badge-green`, `badge badge-yellow`, `badge badge-red`
- Tables: `table table-striped`, `table-hover`

**Dark Mode Toggle:**
```typescript
// In Header.tsx
<button onClick={() => toggleDark()}>
  {isDark ? '☀️ Light' : '🌙 Dark'}
</button>
```

HTML sets `<html class="dark">` when enabled.

---

## Pages: Detailed Breakdown

### Dashboard (`app/page.tsx`)
```
┌─────────────────────────────────────────┐
│ Dashboard                               │
├─────────────────────────────────────────┤
│ MetricsCards (6 KPIs)                   │
├─────────────────────────────────────────┤
│ FlagDistribution | PrescriptionFlow     │
├─────────────────────────────────────────┤
│ RecentAlerts (last 5 RED/YELLOW)        │
└─────────────────────────────────────────┘
```

### Prescriptions (`app/prescriptions/page.tsx`)
```
┌─────────────────────────────────────────┐
│ Prescriptions                           │
├─────────────────────────────────────────┤
│ Filters: Flag, Status, Patient, Limit   │
├─────────────────────────────────────────┤
│ DataTable:                              │
│  ID | Patient | Drug | Flag | Status | │
│  ... (sortable, clickable rows)         │
└─────────────────────────────────────────┘
```

Click row → DetailDrawer opens with:
- Rx details (dose, frequency, days_supply)
- All flags (title, severity, evidence, action)
- Action button: Approve / Review / Flag
- Copilot panel (context-aware)

### Copilot Integration
On prescription detail, CopilotPanel:
```
┌─ Copilot ─────────────┐
│ "Any generic for this?│
│  Is there REMS?       │
│  Check drug interaction?"
├───────────────────────┤
│ You: "Check generics" │
│ AI: "Yes, atorvastatin│
│     saves $50/month"  │
│ [Message box...  ]    │
│ [Send]                │
└───────────────────────┘
```

Quick Questions: Auto-generated suggestions from `GET /copilot/quick-questions?prescription_id=...`

### Settings (`app/settings/page.tsx`)
- User preferences (items per page, default filters)
- API URL config (for self-hosted)
- Mode selector (TPA/PBA)
- Dark mode toggle
- Export data option
- All persisted to localStorage via SettingsContext

---

## API Proxy Configuration (`next.config.js`)

```javascript
module.exports = {
  rewrites: async () => ({
    beforeFiles: [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8000/api/v1/:path*',
      },
    ],
  }),
};
```

Allows frontend to call `/api/v1/*` without CORS issues; Next.js proxies to backend.

---

## Development Workflow

### Local Development
```bash
npm run dev
# Auto-reload on file save
# Inspect React components in DevTools
```

### Building for Production
```bash
npm run build
npm start
```

### Deployment to Vercel
```bash
vercel deploy
# or
git push origin main  # Auto-deploys if configured
```

Set env var in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://api-backend.render.com
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "API calls failing" | Check backend at `http://localhost:8000/docs` |
| "Copilot returns empty" | Claude API key missing; check `.env` |
| "Dark mode not toggling" | Ensure ThemeContext wraps app |
| "Page shows 404" | Check route in `app/` directory |
| "Slow load times" | Check `npm run build` size; may need optimization |

---

## Performance Tips

1. **Image Optimization** — Use Next.js `<Image>` component
2. **Code Splitting** — Use dynamic imports for heavy components
3. **Data Fetching** — Use SWR or React Query for caching
4. **Tailwind Purging** — Automatic in build; monitor bundle size

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

No IE11 support (modern JS only).

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout, provider setup |
| `app/page.tsx` | Home / Dashboard |
| `components/layout/AppShell.tsx` | Main wrapper |
| `components/ui/CopilotPanel.tsx` | Floating AI chat |
| `lib/api.ts` | API client |
| `context/AuthContext.tsx` | User state |
| `types/index.ts` | TypeScript definitions |

---

## Next Steps

1. **Customize Branding** → Logo, colors, app title
2. **Add Export Features** → PDF/CSV reports
3. **Implement Real Auth** → OAuth2, SAML
4. **Performance Testing** → Lighthouse, WebPageTest
5. **Accessibility** → WCAG 2.1 AA compliance review

---

**Axeris Frontend v0.8** — Clinical Decision Support UI
**Built on:** Next.js 14, TypeScript, Tailwind CSS, Recharts
**Last Updated:** April 2026
