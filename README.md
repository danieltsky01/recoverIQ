# Hospital Scorer

## One-click run inside VS Code

1. Open this folder in VS Code.
2. Press Ctrl+Shift+P (or View > Command Palette) and type: `Run Task`.
3. Choose: `App: Run All`.
   - This will:
     - Create/activate the backend Python venv if needed, install deps, and start FastAPI at http://localhost:8000
     - Install frontend deps if needed and start Vite at http://localhost:5173
4. Open http://localhost:5173 in your browser.

## Manual run

### Backend
```powershell
cd .\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```powershell
cd .\frontend
npm install
npm run dev
```

## API quick test
```powershell
$body = @{
  name = "Acme Health"
  gross_revenue = 50000000
  total_ar = 7500000
  avg_balance = 1200
  debt_age = 180
  recovery_rate = 12
  self_pay_percent = 30
  zip_income = 68000
  statute_months = 18
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8000/score" -ContentType "application/json" -Body $body
```

## Security notes (MVP)
- Do not submit PHI (no names, MRNs, DOBs, addresses). This tool is for aggregate business metrics only.
- Use HTTPS/TLS in any hosted environment.
- Restrict CORS to your domain in production.
- Add basic auth or an API key before sharing externally.
- Avoid logging request bodies; log minimal metadata.
- Add rate limiting when public.
