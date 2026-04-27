# ChainGuard AI -- Backend

FastAPI service implementing the 7-layer architecture from the spec.

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # optional
uvicorn main:app --reload --port 8000
```

OpenAPI docs: <http://localhost:8000/docs>

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/predict-risk` | Rule-based + RandomForest risk score |
| `POST` | `/predict-quality` | Avocado quality decay forecast |
| `POST` | `/optimize-route` | Computes primary + alternative routes, decision, explanation |
| `POST` | `/explain` | Gemini-powered natural-language reasoning |
| `POST` | `/inject-disruption` | Apply a disruption and re-evaluate the shipment |
| `POST` | `/simulate-impact` | Cascading downstream impact estimate |
| `GET`  | `/shipments` / `/shipments/{id}` | Read shipment state |
| `POST` | `/shipments` | Create a shipment |

## Optional environment variables

All keys are optional -- the app falls back to deterministic mocks.
See `.env.example`.

## Docker

```bash
docker build -t chainguard-api .
docker run -p 8000:8000 --env-file .env chainguard-api
```

## Cloud Run (sketch)

```bash
gcloud builds submit --tag gcr.io/$PROJECT/chainguard-api
gcloud run deploy chainguard-api \
  --image gcr.io/$PROJECT/chainguard-api \
  --platform managed --region us-central1 --allow-unauthenticated
```
