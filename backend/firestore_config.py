from __future__ import annotations
from typing import Optional, Dict

def get_scoring_weights(project_id: Optional[str] = None) -> Optional[Dict[str, float]]:
    """
    Attempt to read scoring weights from Firestore document `config/scoringWeights`.
    Returns a dict of weights or None if Firestore isn't configured.

    This uses Application Default Credentials (ADC). Locally, set
    GOOGLE_APPLICATION_CREDENTIALS to a service account JSON. In Cloud Run,
    ADC is automatically provided via the service account.
    """
    try:
        from google.cloud import firestore  # type: ignore
        client = firestore.Client(project=project_id) if project_id else firestore.Client()
        doc = client.collection("config").document("scoringWeights").get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}

        # Map Firestore config to the subset used by the current MVP
        # We map high-level framework weights to field-specific weights here.
        # Defaults mirror the original MVP proportions when keys are missing.
        weights = {
            # recovery_rate factor weight
            "recovery_rate": float(data.get("recovery_rate", 25)),
            # statute_limitations maps to statute_months factor
            "statute_months": float(data.get("statute_limitations", 20)),
            # self_pay_percent (inverse relationship)
            "self_pay_percent": float(data.get("payer_mix", 20)),
            # geographic_mix mapped to zip_income factor
            "zip_income": float(data.get("geographic_mix", 15)),
            # portfolio_age mapped to debt_age factor
            "debt_age": float(data.get("portfolio_age", 20)),
        }

        return weights
    except Exception:
        # If the SDK isn't installed or credentials are missing, silently fall back
        return None
