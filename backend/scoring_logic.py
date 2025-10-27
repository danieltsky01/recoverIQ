from pydantic import BaseModel
from typing import Optional, Dict


def compute_scores(data: BaseModel, weights: Optional[Dict[str, float]] = None) -> dict:
	"""
	Core scoring logic for hospital receivables.

	Inputs expected on `data`:
	- recovery_rate: percent 0-100
	- statute_months: months remaining
	- self_pay_percent: percent 0-100
	- zip_income: income in USD
	- debt_age: days

	Returns dict with keys:
	- weighted_score: 0.0 - 5.0 (2 decimals)
	- risk_level: "Low Risk" | "Medium Risk" | "High Risk"
	- recommended_purchase_value: 0.0 - 0.25 ($ per $1 of debt)
	"""
	# Default weights mirror the original MVP (sum to 100)
	default_weights: Dict[str, float] = {
		"recovery_rate": 25.0,
		"statute_months": 20.0,
		"self_pay_percent": 20.0,
		"zip_income": 15.0,
		"debt_age": 20.0,
	}
	w = weights or default_weights

	total_weight = sum(w.values()) or 100.0

	score = 0.0

	# Recovery rate: saturate at 10% for max points (simple heuristic)
	score += min((data.recovery_rate or 0) / 10, 1) * w.get("recovery_rate", default_weights["recovery_rate"])

	# Statute months: more time remaining is better; 24+ months gives max
	score += max(0.0, (data.statute_months or 0) / 24) * w.get("statute_months", default_weights["statute_months"])

	# Self-pay share: less self-pay generally improves collections
	score += (1 - min((data.self_pay_percent or 0) / 100, 1)) * w.get("self_pay_percent", default_weights["self_pay_percent"])

	# Area income: higher income can correlate with better recoveries
	score += min((data.zip_income or 0) / 100_000, 1) * w.get("zip_income", default_weights["zip_income"])

	# Debt age: newer debt is better; 0-365 days window
	score += (1 - min((data.debt_age or 0) / 365, 1)) * w.get("debt_age", default_weights["debt_age"])

	# Normalize to a 0-5 scale based on total_weight
	weighted_score = round(score / total_weight * 5, 2)
	risk_level = (
		"Low Risk" if weighted_score >= 4 else
		"Medium Risk" if weighted_score >= 3 else
		"High Risk"
	)
	# Suggested price per $1 face value: 0.10 to 0.25
	purchase_value = round(0.10 + (weighted_score / 5) * 0.15, 2)

	return {
		"weighted_score": weighted_score,
		"risk_level": risk_level,
		"recommended_purchase_value": purchase_value,
	}

