# Scoring Calculator - Configuration Guide

## Editable Settings (No Firestore Required!)

The Scoring Calculator now has **fully editable settings** directly in the UI. No need to modify Firestore or hardcode values!

## How to Adjust Calculator Settings

### 1. Navigate to Scoring Calculator
- Admin page → **Scoring Calculator** tab

### 2. Click "Edit Settings"
- Top-right of the blue **Calculator Configuration** panel
- Shows current settings by default
- Click to expand the editor

### 3. Adjust Risk Tiers
Edit the 5 risk tier thresholds:
- **Excellent**: Minimum score (default: 80)
- **Good**: Minimum score (default: 60)
- **Fair**: Minimum score (default: 40)
- **Poor**: Minimum score (default: 20)
- **Critical**: Minimum score (default: 0)

**Example:** Change "Good" from 60 to 70 to make scoring more strict.

### 4. Adjust Purchase Value Range
Set the purchase value multiplier range:
- **Minimum**: Purchase value when score = 0 (default: 0.10 = 10%)
- **Maximum**: Purchase value when score = 100 (default: 0.25 = 25%)

**Formula:** `min + (score/100 × (max - min))`

**Example:** 
- Min: 0.05 (5%)
- Max: 0.30 (30%)
- Score 50 → 0.05 + (0.5 × 0.25) = 0.175 (17.5%)

### 5. Apply Changes
- Click **"Apply Changes"** to save settings (in-memory)
- Settings persist until page reload
- Click **"Reset to Defaults"** to restore original values

## Current Settings Storage

**Important:** Settings are currently stored in **component state only**.

- ✅ **Active during session**: Settings apply immediately to all calculations
- ❌ **Not persisted**: Lost on page reload
- 🔜 **Coming soon**: Save to Firestore option

## How Calculations Work

### Overall Score (0-100)
1. Backend evaluates each KPI's scoring rules
2. Auto-normalizes scores (supports any range)
3. Applies KPI weights
4. Returns weighted average × 100

### Risk Tier
Uses your custom thresholds:
```typescript
score >= 80 → Excellent
score >= 60 → Good
score >= 40 → Fair
score >= 20 → Poor
score < 20  → Critical
```

### Purchase Value
Uses your custom min/max:
```typescript
purchaseValue = min + (score/100 × (max - min))
```

### Collectability Index
```typescript
collectability = Math.round(overallScore)
```

### Confidence Level
Based on Data Quality KPIs:
- **High**: Avg Data Quality > 80
- **Medium**: Avg Data Quality 50-80
- **Low**: Avg Data Quality < 50

## Examples

### Make Scoring More Lenient
```
Risk Tiers:
- Excellent: ≥70 (was 80)
- Good: ≥50 (was 60)
- Fair: ≥30 (was 40)
- Poor: ≥10 (was 20)
- Critical: ≥0
```

### Increase Purchase Value Range
```
Min: 0.15 (15%)
Max: 0.40 (40%)

Results:
- Score 0   → 15%
- Score 50  → 27.5%
- Score 100 → 40%
```

### Conservative Purchase Values
```
Min: 0.05 (5%)
Max: 0.15 (15%)

Results:
- Score 0   → 5%
- Score 50  → 10%
- Score 100 → 15%
```

## Tips

1. **Test Changes**: Adjust settings → Calculate with sample data → Review results
2. **Export Results**: Click "Export Results" to save JSON with applied settings
3. **Compare Scenarios**: Try different risk tier thresholds to see impact
4. **Document Your Changes**: Screenshot or note your custom settings for team reference

## Future Enhancements

- [ ] Save settings to Firestore
- [ ] Multiple calculation profiles (Conservative, Aggressive, etc.)
- [ ] Custom collectability formulas
- [ ] History of calculation settings used
- [ ] Import/Export settings as JSON
- [ ] Team-wide default settings
