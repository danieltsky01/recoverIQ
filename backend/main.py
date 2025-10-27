from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Support both running from backend/ (uvicorn main:app) and importing as package (backend.main)
try:  # when executed from backend directory
    from scoring_logic import compute_scores  # type: ignore
    from settings import settings  # type: ignore
    from firestore_config import get_scoring_weights  # type: ignore
except ImportError:  # when imported as backend.main
    from .scoring_logic import compute_scores  # type: ignore
    from .settings import settings  # type: ignore
    from .firestore_config import get_scoring_weights  # type: ignore

app = FastAPI(title=settings.api_title)

class HospitalData(BaseModel):
    name: str
    gross_revenue: float = Field(ge=0, description="Annual gross revenue in USD")
    total_ar: float = Field(ge=0, description="Total accounts receivable in USD")
    avg_balance: float = Field(ge=0, description="Average patient balance in USD")
    debt_age: int = Field(ge=0, description="Average age of debt in days")
    recovery_rate: float = Field(ge=0, le=100, description="Expected recovery rate as percent 0-100")
    self_pay_percent: float = Field(ge=0, le=100, description="Percent of self-pay accounts 0-100")
    zip_income: float = Field(ge=0, description="Median household income for the ZIP code")
    statute_months: int = Field(ge=0, description="Months remaining before statute of limitations")


# CORS for local dev; restrict in production via .env
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/score")
def score_hospital(data: HospitalData):
    """Scores hospital receivables and returns weighted score, risk, and value."""
    # Try to load weights from Firestore if available; otherwise fall back to defaults
    weights = get_scoring_weights(settings.firestore_project_id)
    results = compute_scores(data, weights=weights)
    return {
        "hospital": data.name,
        **results,
    }
