# Scoring Calculator - User Guide

## How to Use

### 1. Navigate to Scoring Calculator
- Go to Admin page
- Click **Scoring Calculator** tab (3rd tab)

### 2. Enter KPI Values
The calculator shows all KPIs organized by category:
- **Financial Performance**: Days Outstanding, Recovery Rate, etc.
- **Portfolio Composition**: Average Debt Age, Statute of Limitations
- **Operational Efficiency**: Data Accuracy, Duplicate Rate
- **Legal & Compliance**: Compliance Rate
- **Data Quality**: Missing Fields
- **Ethical/ESG**: (future KPIs)

Enter values in the appropriate fields for each KPI.

### 3. Calculate Score
- Click **Calculate Score** button (blue button at top)
- Wait for "Calculating..." message
- Results appear below in real-time

### 4. Review Results
The calculator displays:
- **Overall Score**: 0-100 weighted score
- **Risk Tier**: Excellent (80+) | Good (60+) | Fair (40+) | Poor (20+) | Critical (0+)
- **Collectability Index**: Estimated collectability (0-100)
- **Purchase Value**: Recommended purchase multiplier (0.10-0.25)
- **Confidence Level**: High | Medium | Low (based on data quality)

**Category Scores**: Breakdown by KPI category
**Individual KPI Scores**: Each KPI's contribution to overall score

### 5. Export Results (Optional)
- Click **Export Results** to download JSON file
- Useful for record-keeping or further analysis

## How It Works (Behind the Scenes)

### Backend Evaluation
1. Frontend sends KPI inputs to Firebase Function
2. Backend loads KPI definitions from Firestore (`config/kpis`)
3. For each KPI, evaluates scoring rules against input value
4. Auto-normalizes scores (supports any score range, not just 0-1)
5. Calculates weighted average × 100 = overall score

### Default Formulas (No Config Required)
The calculator works out-of-the-box with these defaults:

**Risk Tiers:**
- Excellent: 80-100
- Good: 60-79
- Fair: 40-59
- Poor: 20-39
- Critical: 0-19

**Collectability Index:**
```
collectability = overall_score (rounded)
```

**Purchase Value:**
```
purchase_value = 0.10 + ((score / 100) * 0.15)
```
- Minimum: 0.10 (10% for score 0)
- Maximum: 0.25 (25% for score 100)

**Confidence Level:**
```
Based on average of Data Quality KPIs:
- High: Data Quality avg > 80
- Medium: Data Quality avg 50-80
- Low: Data Quality avg < 50
```

## Optional Advanced Features

### Test Scenarios (Optional)
- Upload `test-scenarios-seed.json` to `config/test_scenarios` in Firestore
- Quick-load pre-configured test cases
- Not required for basic calculator functionality

### Custom Risk Tiers & Formulas (Optional)
- Upload `scoring-system-seed.json` to `config/scoring_system` in Firestore
- Override default risk tiers
- Use custom formulas for collectability, purchase value, confidence
- Supports dynamic expressions using KPI scores and category averages

## Troubleshooting

### "Please enter at least one KPI value"
- Enter a value in at least one KPI field before clicking Calculate

### "Calculation failed"
1. Open browser console (F12)
2. Look for error messages starting with "=== CALCULATION ERROR ==="
3. Check if Firebase Functions are running:
   ```powershell
   cd backend
   firebase emulators:start
   ```
4. Verify API_URL is correct (should auto-detect localhost:5001)

### No Results Appearing
1. Check browser console for detailed logs
2. Verify backend is running on port 5001
3. Check that KPIs exist in Firestore (`config/kpis`)

### Backend Not Running
```powershell
# Terminal 1: Start Firebase emulators
cd backend
firebase emulators:start

# Terminal 2: Start frontend dev server
cd frontend
npm run dev
```

## API Reference

### POST /scoreHospital
**Request:**
```json
{
  "name": "Test Hospital",
  "days_outstanding": 45,
  "recovery_rate": 0.72,
  "average_debt_age": 180,
  ...
}
```

**Response:**
```json
{
  "overall_score": 68.5,
  "risk_tier": "Good",
  "collectability_index": 69,
  "recommended_purchase_value": 0.203,
  "confidence_level": "High",
  "category_scores": [...],
  "kpi_scores": [...]
}
```

## File Locations

**Frontend:**
- Component: `frontend/src/components/admin/ScoringCalculator.tsx`
- Types: `frontend/src/lib/scoringTypes.ts`
- Seed data (optional): `frontend/public/test-scenarios-seed.json`, `frontend/public/scoring-system-seed.json`

**Backend:**
- Function: `functions/src/index.ts` → `evaluateKpis()`
- Firestore:
  - Required: `config/kpis` (KPI definitions)
  - Optional: `config/scoring_system` (risk tiers, formulas)
  - Optional: `config/test_scenarios` (test data)

## Next Steps

1. **Load Your 13 KPIs**: Import `kpis-seed.json` and `kpis-recovery.json` via KPI Admin tab
2. **Test Calculator**: Enter sample values and click Calculate
3. **Add Test Scenarios** (optional): Create test scenarios for common hospital profiles
4. **Customize Risk Tiers** (optional): Upload custom scoring system config
