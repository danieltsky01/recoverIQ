"""
Lightweight backend self-test without starting a server.
- Imports FastAPI app from backend.main
- Uses TestClient to call /health and /score
- Exits non-zero if any assertion fails
"""
from __future__ import annotations
import sys
from pathlib import Path

# Ensure project root is on PYTHONPATH so 'backend.*' can be imported
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # type: ignore

try:
    from backend.main import app  # type: ignore
except Exception as e:
    print(f"ERROR: Failed to import backend.main.app: {e}")
    sys.exit(1)

client = TestClient(app)

# 1) Health check
resp = client.get("/health")
assert resp.status_code == 200, f"/health status {resp.status_code} != 200"
body = resp.json()
assert body.get("status") == "ok", f"Unexpected /health response: {body}"

# 2) Score endpoint (happy path)
payload = {
    "name": "Test Hospital",
    "gross_revenue": 1_000_000,
    "total_ar": 200_000,
    "avg_balance": 500,
    "debt_age": 90,
    "recovery_rate": 30,
    "self_pay_percent": 15,
    "zip_income": 60000,
    "statute_months": 18,
}
resp = client.post("/score", json=payload)
assert resp.status_code == 200, f"/score status {resp.status_code} != 200: {resp.text}"
body = resp.json()
for key in ("hospital", "weighted_score", "risk_level", "recommended_purchase_value"):
    assert key in body, f"Missing key in /score response: {key}"

print("Backend validation passed: /health and /score OK")
