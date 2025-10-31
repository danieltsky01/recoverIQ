# Hospital Scorer - Development Setup

## ✅ Quick Start (One Command!)

```powershell
npm run dev
```

This starts:
- **Backend API** on http://localhost:5001 (Express server)
- **Frontend** on http://localhost:5173 (Vite dev server)

Then open http://localhost:5173 in your browser.

---

## 🎉 What's New?

**No more Java or Firebase Emulator required!**
- ✅ Simple Express dev server
- ✅ One `npm run dev` command
- ✅ Full CORS support
- ✅ Live reload on code changes
- ✅ Works on Windows without extra dependencies

---

## 📁 Project Structure

```
hospital-scorer/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/          # SignIn, Admin, HospitalDetail
│   │   ├── components/
│   │   │   ├── admin/      # KPIAdmin, ScoringCalculator, HospitalsAdmin
│   │   │   └── ...
│   │   └── lib/            # Firebase config, types
│   └── package.json
├── functions/              # Backend API
│   ├── src/
│   │   └── index.ts        # Production (Firebase Functions)
│   ├── dev-server.ts       # Development (Express)
│   └── package.json
├── backend/                # ⚠️ DEPRECATED (Python FastAPI - ignore)
└── package.json            # Root - runs both services
```

---

## 🚀 First Time Setup

### 1. Install Dependencies

```powershell
# Install root dependencies
npm install

# Install backend dependencies
cd functions
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 2. Configure Firebase

Create `frontend/.env`:

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Create `functions/.env` (optional):

```bash
FIREBASE_PROJECT_ID=your-project-id
PORT=5001
```

### 3. Start Development

```powershell
npm run dev
```

You should see:
```
[API] 🚀 Development server running on http://localhost:5001
[WEB] ➜ Local: http://localhost:5173/
```

---

## 💻 Development Commands

### Root Directory

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend + backend |
| `npm run build` | Build both for production |

### Frontend (`cd frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server only |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

### Backend (`cd functions`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express dev server only |
| `npm run build` | Compile TypeScript |
| `npm run deploy` | Deploy to Firebase Functions |

---

## 🔧 How It Works

### Development Mode

```
User Browser (localhost:5173)
         ↓
    Vite Dev Server (Frontend)
         ↓ POST /scoreHospital
Express Dev Server (localhost:5001)
         ↓ Firestore SDK
   Google Cloud Firestore
```

**Backend:**
- `dev-server.ts` - Express server with CORS
- Connects directly to Firestore
- No emulator needed
- Live reload with `tsx watch`

**Frontend:**
- Vite dev server with HMR
- Calls backend at `http://localhost:5001`
- Firebase SDK for auth + Firestore

### Production Mode

```
User Browser
     ↓
Firebase Hosting (serves frontend/dist)
     ↓ /api/* rewrite
Firebase Cloud Functions
     ↓
Google Cloud Firestore
```

---

## 🧪 Testing the API

### Health Check

```powershell
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-28T..."
}
```

### Score Hospital

```powershell
$body = @{
  name = "Test Hospital"
  recovery_rate = 0.75
  days_outstanding = 45
  debt_age = 180
  data_accuracy = 0.95
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5001/scoreHospital" `
  -ContentType "application/json" `
  -Body $body
```

Expected response:
```json
{
  "hospital": "Test Hospital",
  "overall_score": 68.5,
  "category_scores": { ... },
  "kpi_scores": [ ... ]
}
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Frontend (port 5173):**
```powershell
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

**Backend (port 5001):**
```powershell
Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### CORS Errors

✅ **Solution:**
- Make sure backend is running (`npm run dev` from root)
- Check backend console for startup message
- Verify `http://localhost:5001/health` returns `{"status":"ok"}`

### Firestore Connection Issues

1. **Check Firebase config** in `frontend/.env`
2. **Verify Firestore rules** allow your user
3. **Check browser console** for authentication errors
4. **Test Firestore access** in Firebase Console

### No KPIs Found

1. Go to Admin → KPIs tab
2. Click "Import KPIs"
3. Upload `frontend/public/kpis-seed.json`
4. Should load 10 KPIs
5. Also import `kpis-recovery.json` for 3 more

---

## 📊 System Architecture

### Scoring Flow

1. **User enters KPI values** in Scoring Calculator
2. **Frontend sends POST** to `/scoreHospital`
3. **Backend loads KPIs** from `config/kpis` in Firestore
4. **Evaluates rules** (e.g., `recovery_rate >= 0.75` → score 5)
5. **Auto-normalizes** scores based on min/max in rules
6. **Applies weights** and calculates weighted average
7. **Returns score** (0-100) + category breakdowns
8. **Frontend calculates** risk tier, purchase value, collectability

### Firestore Collections

```
config/
  ├── kpis                    # KPI definitions (13 KPIs)
  ├── scoring_system          # Optional: custom risk tiers
  └── test_scenarios          # Optional: test data

hospitals/                    # Scored hospitals
  └── {hospitalId}/
      ├── name
      ├── scores
      └── metadata

admins/                       # Admin permissions
  └── {userId}/
      └── role: "admin"
```

### KPI Schema Example

```typescript
{
  id: "recovery_rate",
  name: "Recovery Rate",
  category: "Financial Performance",
  metric_type: "Financial",
  unit: "%",
  weight: 0.10,  // 10%
  scoring_rules: [
    { condition: "recovery_rate >= 0.75", score: 5 },
    { condition: "recovery_rate >= 0.50", score: 3 },
    { condition: "recovery_rate >= 0.25", score: 1 }
  ],
  trend_direction: "Higher is better",
  benchmark_range: { low: 0.50, high: 0.80 }
}
```

---

## 🚢 Deployment

### Build for Production

```powershell
npm run build
```

This builds:
- `functions/lib/` - Compiled TypeScript
- `frontend/dist/` - Optimized static files

### Deploy to Firebase

```powershell
firebase deploy
```

This deploys:
- Functions to Firebase Cloud Functions
- Frontend to Firebase Hosting
- Firestore indexes and rules

### Environment Variables

Production requires:
- Firebase project configured
- Service account for Cloud Functions
- CORS restricted to your domain
- Firestore security rules enabled

---

## 🔐 Security Checklist

- [ ] No PHI in any requests (aggregate metrics only)
- [ ] HTTPS enforced in production
- [ ] CORS restricted to actual domain
- [ ] API authentication enabled
- [ ] Firestore security rules active
- [ ] Rate limiting configured
- [ ] Error messages don't leak sensitive data
- [ ] Admin-only endpoints protected

---

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev/guide/)

---

**Ready to build!** 🎉

Run `npm run dev` and open http://localhost:5173
