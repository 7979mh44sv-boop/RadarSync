# RadarSync

**Precision Timing. Distributed Intelligence.**

RadarSync is a scientific simulation and web dashboard built for the
**NextSemi Deep-Tech Hackathon** (imec.xpand *Chip-Scale Atomic Clock Venture Challenge*).
It investigates whether a chip-scale atomic clock (CSAC) with a breakthrough short-term
stability of **ADEV < 1 × 10⁻¹⁵ at τ = 1 s** (otherwise Microchip SA65 reference specs)
creates measurable, system-level value in **distributed radar**.

> **Project status:** the clock noise model (Phase 1) and the multi-node radar synchronisation
> and timing-error model (Phase 2: relative time/phase error, coherent integration loss) are
> implemented and numerically validated. All system parameters are assumptions and all results
> are simulated. The repository makes **no detection-range, RCS or operational performance claims**.

## Validation principles (from the challenge brief)

The simulation is designed to satisfy the challenge's *Validation evidence* criterion:

- Connect the clock specification to a **customer-relevant system metric**.
- Compare a **baseline architecture** with at least one **competing architecture**.
- Include **noise sources beyond the clock** (distribution jitter, link noise, drift, temperature, …).
- Run **sensitivity analyses**: when is the clock the limiting factor, and what is the minimum
  clock performance actually required?
- Keep **sourced inputs**, **engineering assumptions** and **simulated outputs** strictly separate
  (enforced via `backend/radarsync_sim/provenance.py`).

Model documentation:
[docs/clock_noise_model.md](docs/clock_noise_model.md) (Phase 1) ·
[docs/radar_timing_model.md](docs/radar_timing_model.md) (Phase 2).
Regenerate the Phase 2 results with `cd backend && .venv/bin/python scripts/phase2_report.py`.

## Repository layout

```
radarsync/
├── backend/                  FastAPI service + simulation engine (Python)
│   ├── app/                  FastAPI web layer (no physics)
│   │   ├── main.py           FastAPI app, CORS
│   │   ├── config.py         Settings from environment (RADARSYNC_*)
│   │   └── api/health.py     GET /health
│   ├── radarsync_sim/        Simulation engine (NumPy/SciPy only, no web imports)
│   │   ├── provenance.py     SOURCED / ASSUMPTION / HYPOTHETICAL_TARGET / SIMULATED labels
│   │   ├── parameters.py     Sourced reference data (SA65 datasheet, challenge brief)
│   │   ├── noise.py          White / flicker / random-walk FM generators
│   │   ├── clock.py          y(t), time error x(t), phase error phi(t)
│   │   ├── stability.py      Overlapping Allan deviation
│   │   ├── scenarios.py      OCXO, SA65, hypothetical NextGen CSAC
│   │   ├── timing_errors.py  Non-clock error terms, sync configuration
│   │   ├── network.py        Multi-node timing with synchronisation
│   │   ├── coherence.py      Coherent gain + analytical expectations
│   │   ├── radar.py          Relative time/phase error, coherent loss, comparisons
│   │   └── consistency.py    Model-implied phase noise vs. SA65 limits
│   ├── scripts/              Reproducible reports (phase2_report.py)
│   ├── tests/                pytest suite (tests/sim: numerical validation)
│   └── requirements.txt
├── frontend/                 Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
│   ├── src/
│   │   ├── app/              Layout, page, global theme
│   │   ├── components/       Dashboard, panels (clock, timing, coherence, controls, provenance), SVG charts
│   │   └── lib/              Typed API client, formatting/scales, scenario styles
│   └── tests/                node:test unit tests + live-API render integration test
├── docs/                     Documentation and reports
└── .env.example
```

## Prerequisites

| Tool    | Version used     |
|---------|------------------|
| Python  | 3.14 (≥ 3.12 supported) |
| Node.js | 26.x (npm 11)    |

## Quick start

### 1. Backend (FastAPI) at http://localhost:8000

```bash
cd backend
python3 -m venv .venv                 # first time only
.venv/bin/pip install -r requirements.txt   # first time only
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

### 2. Frontend (Next.js) at http://localhost:3000

```bash
cd frontend
npm install                           # first time only
npm run dev
```

The landing page shows a live **Simulation Engine Link** panel that polls `GET /health`
every 10 s. To point it at another backend, set `NEXT_PUBLIC_API_BASE_URL` in
`frontend/.env.local` (see `.env.example`).

### Simulation API (v1)

The FastAPI layer (`backend/app/api/simulation.py`, models in `backend/app/schemas.py`) is a thin adapter
over `radarsync_sim`; it contains no physics. Interactive documentation: http://localhost:8000/docs

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/scenarios` | Clock scenarios with per-parameter provenance, SA65 datasheet ADEV points, NextGen target |
| GET | `/api/v1/parameters` | Configurable parameters, allowed ranges, computation limits and rules |
| GET | `/api/v1/limitations` | Model limitations and the SA65 phase-noise consistency check |
| POST | `/api/v1/clock/adev` | Analytic ADEV curves (constrained range flagged) and simulated overlapping ADEV |
| POST | `/api/v1/network/timing` | Relative timing-error time series for a node pair (clock vs. non-clock) |
| POST | `/api/v1/radar/coherence` | Temporal and spatial coherent-integration loss per scenario (Monte Carlo) |

Requests are validated (node count, carrier frequency, durations, sync interval, seeds, array sizes) and
bounded by a computation budget; invalid requests return HTTP 422 with a readable message.

### Tests and checks

```bash
cd backend && .venv/bin/pytest -q     # backend tests
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && npm run test:integration   # renders dashboard panels with live API data (backend must be running)
```

## License

To be determined.
