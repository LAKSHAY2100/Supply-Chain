# ChainGuard AI -- Resilient Supply Chain Intelligence (MVP)

AI-powered, perishable-aware supply chain intelligence demo built on the
**Track -> Analyze -> Predict -> Simulate -> Decide -> Explain** loop.

Use case: shipping avocados from **Mombasa, Kenya -> Mumbai, India**.

- **Backend**: FastAPI + NetworkX + scikit-learn + Gemini Pro
- **Frontend**: React + Vite + Tailwind + Zustand + Recharts + Google Maps
- **Persistence**: Firestore (with graceful in-memory fallback)
- **External APIs**: Mock-first hybrid -- works fully offline; auto-uses real APIs if keys present

---

## Quick Start (Windows / PowerShell)

### 1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # optional - works without any keys
uvicorn main:app --reload --port 8000
```

Backend will be live at <http://localhost:8000>. Auto-generated docs at <http://localhost:8000/docs>.

### 2. Frontend (new terminal)

```powershell
cd frontend
npm install --ignore-scripts        # --ignore-scripts skips the esbuild postinstall
                                    # quirk on some Windows / Cursor Node setups
copy .env.example .env              # optional - paste VITE_GOOGLE_MAPS_KEY for live maps
npm run dev                         # or `node node_modules/vite/bin/vite.js`
```

Frontend will be live at <http://localhost:5173>.

---

## What You Can Demo

1. **Auto-loaded scenario**: 2,000 kg avocado shipment Mombasa -> Mumbai with two
   candidate routes (Direct Sea via Colombo vs Via Dubai Air+Sea).
2. **Risk + Quality dashboards**: live risk score, delay probability, and avocado
   quality decay curves per route.
3. **Inject disruption**: click the button to simulate a port delay at Dubai or Colombo.
   Watch the system re-score risk, recompute quality, and recommend a reroute.
4. **Gemini explanation**: a natural-language summary of the decision is rendered
   in the right-hand panel (or a deterministic template if no Gemini key).
5. **Impact simulation**: shows how many downstream shipments and operations
   are affected by the disruption.

---

## Optional API Keys

All keys are optional. The app degrades gracefully to deterministic mocks.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Real Gemini Pro explanations (Google AI Studio) |
| `GOOGLE_MAPS_API_KEY` | Real distance / directions in backend |
| `OPENWEATHER_API_KEY` | Real weather conditions per waypoint |
| `FIRESTORE_SA_JSON` | Path to Firebase service-account JSON for Firestore persistence |
| `VITE_GOOGLE_MAPS_KEY` | Renders live Google Maps in frontend (otherwise SVG fallback) |
| `VITE_API_BASE_URL` | Defaults to `http://localhost:8000` |

---

## Architecture (per spec)

```
React UI
   |  POST /optimize-route, /inject-disruption, /explain
FastAPI
   +-- gmaps.py / weather.py        (mock or real)
   +-- risk_engine.py               (rules + RandomForest)
   +-- quality_engine.py            (avocado decay formula)
   +-- graph.py                     (NetworkX Dijkstra + Yen K-shortest)
   +-- decision_engine.py           (multi-objective thresholds)
   +-- gemini.py                    (4 prompt templates + fallback)
   +-- firestore.py                 (firebase-admin or in-memory)
```

See `1.md` and `3.pdf` in this repo for the full spec.

---

## Project Layout

```
powerbase/
+-- backend/        # FastAPI app
+-- frontend/       # React + Vite app
+-- 1.md            # Problem statement & architecture
+-- 3.pdf           # Tech-stack & implementation plan
+-- README.md       # this file
```
