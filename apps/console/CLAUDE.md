# Axeris — Project Instructions

AI clinical decision-support demo for prescription review, pitched to TPAs and PBAs.
Backend: **Python FastAPI + SQLite** (`backend/`). Frontend: **Next.js 15 + React 19 +
TypeScript + Tailwind** (`frontend/`). Current version **v0.8.0**. Deploys: frontend → Vercel,
backend → Render. Repo: github.com/axerisPro/Proto2 (default branch `main`).

Deep, evolving detail lives in the auto-memory topic files (see end). This file holds the
durable facts and invariants.

## Run & verify
```bash
# Backend (reseeds if axeris.db absent; trains ML in a background thread → API ~0.8s)
cd backend && .venv/Scripts/python -m uvicorn main:app --host 127.0.0.1 --port 8000
# Frontend
export PATH="/c/Program Files/nodejs:$PATH"
cd frontend && npx next dev -p 3000     # or: npm run demo  (build + start)
```
- **Reseed = delete `backend/axeris.db`, then restart** the backend. Required after any
  schema or seed change (new cohorts, drugs, columns).
- Kill dev servers **by port PID only** (`netstat -ano | grep :8000` → `taskkill //F //PID <pid>`).
  Never `TASKKILL //IM node.exe/python.exe`.
- Trustworthy typecheck: `rm -f frontend/tsconfig.tsbuildinfo && npx tsc --noEmit`.
  Gate real changes on `next build` (44 routes should compile).

## Architecture
- **Dual mode:** TPA (post-adjudication, plan-sponsor) and PBA (real-time NCPDP D.0). Mode is in
  `localStorage["axeris-mode"]` ("TPA"/"PBA") and drives the sidebar/routes.
- **3 engines / 24 numbered clinical checks:** Rules (`RULE-*`), ML (`ML-*`), Patient-Context
  (`PAT-*`). Flag colors GREEN/YELLOW/RED, dispositions APPROVE/REVIEW/FLAG.
- **Data:** ~44 page routes; 142-drug database; **Truveta TDM is the primary/only EHR+claims
  source** (Kythera for open-claims breadth). MarketScan and REACH were fully removed — do not
  reintroduce them.

## Invariants (violating these breaks the demo)
- **Determinism:** never `random.seed(hash(x))` (hash is process-salted) or bare `random.choice`
  in an endpoint. Use `random.Random(f"key:{id}")` so numbers are stable across requests/restarts
  and paired outputs (e.g. a list and its PDF) share one seed key.
- **Frontend fetch:** all GET pages use `demoFetch` (3-tier stale-while-revalidate cache); mutations
  call `invalidate(prefix)`. New API URLs must be added to `DemoPrefetcher.tsx`, and each mode's
  set is warmed after login.
- **Persisted actions:** PBA/TPA button actions write to the `PbaActionEvent` table; GET endpoints
  overlay those events on synthetic defaults so actions survive reloads.
- **`DataSourceList` sources** must be keys of `SRC_META` in `components/ui/DataSourceBadge.tsx`
  (valid set: Truveta, Kythera, NPPES, LEIE, NADAC, RxNorm, DailyMed, CredibleMeds, CPIC, Beers,
  CDC, Internal). Unknown names render a neutral fallback — don't rely on it.
- **Dark mode:** every container/text/badge needs `dark:` variants (including colored `-50/-100`
  chips). Verify new pages in dark mode.
- All money/impact figures are **deterministic and formula-disclosed** (each worklist endpoint
  returns a `formula` string surfaced in a "How is this computed?" expander). Keep that pattern.

## Local-env gotchas
- Fresh venvs need `uvicorn[standard]` (or `pip install websockets`) or the WebSocket upgrade is
  rejected and the header shows "Offline". `requirements.txt` already pins it; only fresh local
  venvs regress.
- Python 3.14, Node v24; venv at `backend/.venv`.

## Deep-dive memory (auto-memory topic files)
`~/.claude/projects/C--Users-kmmal-OneDrive-Documents-GitHub-Proto1/memory/`:
`perf-cache-architecture.md`, `tpa-painpoint-suite.md`, `local-dev-gotchas.md`,
`truveta-and-hardening.md`.
