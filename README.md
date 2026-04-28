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

## Google-First Hackathon Positioning

This submission is intentionally built to showcase the Google ecosystem end to end:

- `Gemini` for route reasoning, disruption explanation, and the in-app copilot/chatbot
- `Google Maps` for live route rendering and backend distance/ETA enrichment
- `Firestore` for shipment persistence with graceful in-memory fallback for offline demos
- `Cloud Run` for backend deployment
- `Firebase Hosting` for frontend deployment
- `Cloud Build` for backend CI/CD
- `Vertex AI` as the natural next step to productionize the risk model after the hackathon

Even without keys, the app remains fully demoable offline through deterministic mocks. That gives you a safe recording path while still keeping the repo strongly aligned with Google infrastructure.

---

## Demo Flow For Recording

1. Launch backend and frontend locally.
2. Show the auto-loaded avocado shipment from `Mombasa, Kenya -> Mumbai, India`.
3. Highlight route comparison, risk score, quality decay, and the selected route.
4. Open the stage score graph and explain that the shortest path is computed from edge scores.
5. Inject a disruption at `Dubai` or `Colombo Port`.
6. Show that edge penalties increase, the graph updates, and the new shortest path is selected.
7. Use the `Gemini copilot` panel to ask:
   - `Why did the route change after disruption?`
   - `Which Google services are used in this project?`
   - `How does the quality model work for avocados?`
8. Close with the Google deployment plan: `Firebase Hosting + Cloud Run + Firestore + Gemini`.

---

## Google Deployment

### Backend on Cloud Run

```powershell
gcloud builds submit --config infrastructure/cloudbuild.yaml
```

Or manually:

```powershell
gcloud builds submit --tag us-central1-docker.pkg.dev/$env:GOOGLE_CLOUD_PROJECT/chainguard/chainguard-api backend
gcloud run deploy chainguard-api `
  --image us-central1-docker.pkg.dev/$env:GOOGLE_CLOUD_PROJECT/chainguard/chainguard-api `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated
```

### Frontend on Firebase Hosting

```powershell
cd frontend
npm install
npm run build
cd ..
firebase deploy --only hosting
```

Set `VITE_API_BASE_URL` to your Cloud Run URL before building the frontend for production.

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
