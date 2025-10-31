import { useState, useEffect, useMemo } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { KPI } from '@/lib/kpiTypes'
import type { ScoringSystemConfig, ScoringResult, TestScenario } from '@/lib/scoringTypes'
import { Calculator, PlayCircle, Download, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Settings } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

// API configuration - use production in deployed environment, emulator for local dev
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://us-central1-recoveriq-b2b09.cloudfunctions.net'
    : 'http://localhost:5001/recoveriq-b2b09/us-central1')

// Simple safe formula evaluator (replaces eval)
function evaluateFormula(formula: string, context: Record<string, number>): number {
  try {
    // Replace variables in formula with their values
    let expr = formula
    for (const [key, value] of Object.entries(context)) {
      expr = expr.replace(new RegExp(key, 'g'), String(value))
    }
    // Safe eval using Function constructor (limited to math operations)
    const result = new Function(`return ${expr}`)()
    return Number(result) || 0
  } catch (e) {
    console.error('Formula evaluation error:', e)
    return 0
  }
}

export default function ScoringCalculator() {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [scoringConfig, setScoringConfig] = useState<ScoringSystemConfig | null>(null)
  const [testScenarios, setTestScenarios] = useState<TestScenario[]>([])
  const [inputs, setInputs] = useState<Record<string, number>>({})
  const [result, setResult] = useState<ScoringResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  
  // Editable calculator settings (stored in component state, can be saved to Firestore later)
  const [calcSettings, setCalcSettings] = useState({
    riskTiers: [
      { name: 'Excellent', min: 80, color: 'green' },
      { name: 'Good', min: 60, color: 'blue' },
      { name: 'Fair', min: 40, color: 'yellow' },
      { name: 'Poor', min: 20, color: 'orange' },
      { name: 'Critical', min: 0, color: 'red' }
    ],
    purchaseValueMin: 0.10,
    purchaseValueMax: 0.25,
    collectabilityFormula: 'score', // 'score' or 'custom'
    customCollectabilityFormula: ''
  })

  // Load KPIs, scoring config, and test scenarios
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        // Load KPIs (required)
        const kpiSnap = await getDoc(doc(db, 'config', 'kpis'))
        if (kpiSnap.exists()) {
          const data = kpiSnap.data()
          setKpis(Array.isArray(data?.kpis) ? data.kpis : [])
        }

        // Load scoring config (optional)
        try {
          const configSnap = await getDoc(doc(db, 'config', 'scoring_system'))
          if (configSnap.exists()) {
            setScoringConfig(configSnap.data() as ScoringSystemConfig)
          }
        } catch (e) {
          // Scoring config is optional - use defaults
          console.log('Using default scoring config')
        }

        // Load test scenarios (optional)
        try {
          const scenariosSnap = await getDoc(doc(db, 'config', 'test_scenarios'))
          if (scenariosSnap.exists()) {
            const data = scenariosSnap.data()
            setTestScenarios(Array.isArray(data?.scenarios) ? data.scenarios : [])
          }
        } catch (e) {
          // Test scenarios are optional
          console.log('No test scenarios configured')
        }
      } catch (e: any) {
        toast(e.message || 'Failed to load configuration', 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Calculate score
  const handleCalculate = async () => {
    if (Object.keys(inputs).length === 0) {
      toast('Please enter at least one KPI value', 'error')
      return
    }

    setCalculating(true)
    try {
      console.log('=== SCORING CALCULATION START ===')
      console.log('API URL:', API_URL)
      console.log('Sending inputs:', inputs)
      
      const response = await fetch(`${API_URL}/scoreHospital`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, name: 'Test Hospital' })
      })

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Scoring failed (${response.status}): ${errorText}`)
      }

      const data = await response.json() as ScoringResult
      console.log('Backend response:', data)

      // Use editable calculator settings
      const score = data.overall_score

      // Compute risk tier from editable settings
      const tier = calcSettings.riskTiers
        .sort((a, b) => b.min - a.min)
        .find(t => score >= t.min)
      data.risk_tier = tier?.name || 'Unknown'

      // Compute collectability index
      data.collectability_index = Math.round(score)

      // Compute purchase value from editable settings
      const range = calcSettings.purchaseValueMax - calcSettings.purchaseValueMin
      data.recommended_purchase_value = parseFloat((calcSettings.purchaseValueMin + ((score / 100) * range)).toFixed(3))

      // Compute confidence level - based on data quality
      const dataQualityKpis = data.kpi_scores.filter(k => k.category === 'Data Quality')
      const avgDataQuality = dataQualityKpis.length > 0
        ? dataQualityKpis.reduce((sum, k) => sum + k.score, 0) / dataQualityKpis.length
        : 0.5
      data.confidence_level = avgDataQuality > 0.8 ? 'High' : avgDataQuality > 0.5 ? 'Medium' : 'Low'

      console.log('Final enhanced result:', data)
      console.log('=== SCORING CALCULATION COMPLETE ===')
      
      setResult(data)
      toast('Calculation complete', 'success')
    } catch (e: any) {
      console.error('=== CALCULATION ERROR ===')
      console.error(e)
      toast(e.message || 'Calculation failed. Check console for details.', 'error')
    } finally {
      setCalculating(false)
    }
  }

  // Load test scenario
  const loadScenario = (scenarioId: string) => {
    const scenario = testScenarios.find(s => s.id === scenarioId)
    if (scenario) {
      setInputs(scenario.inputs)
      setSelectedScenario(scenarioId)
      setResult(null)
      toast(`Loaded scenario: ${scenario.name}`, 'info')
    }
  }

  // Export results
  const exportResults = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scoring-result-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Results exported', 'success')
  }

  // Categorize KPIs
  const kpisByCategory = useMemo(() => {
    const grouped: Record<string, KPI[]> = {}
    kpis.filter(k => k.enabled !== false).forEach(kpi => {
      if (!grouped[kpi.category]) grouped[kpi.category] = []
      grouped[kpi.category].push(kpi)
    })
    return grouped
  }, [kpis])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Calculator Settings - Editable Configuration */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Calculator Configuration</h3>
          </div>
          <button
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            onClick={() => setShowConfigEditor(!showConfigEditor)}
          >
            <Settings className="w-4 h-4" />
            {showConfigEditor ? 'Hide' : 'Edit'} Settings
          </button>
        </div>
        
        {!showConfigEditor ? (
          // Display current settings
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="font-semibold text-slate-700 mb-2">Risk Tiers</div>
              <div className="text-xs text-slate-600 space-y-1">
                {calcSettings.riskTiers.map((tier, i) => (
                  <div key={i}>{tier.name}: ≥{tier.min}</div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="font-semibold text-slate-700 mb-2">Purchase Value</div>
              <div className="text-xs text-slate-600">
                <code className="bg-slate-100 px-1 rounded">
                  {calcSettings.purchaseValueMin} + (score/100 × {calcSettings.purchaseValueMax - calcSettings.purchaseValueMin})
                </code>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Range: {(calcSettings.purchaseValueMin * 100).toFixed(0)}%-{(calcSettings.purchaseValueMax * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="font-semibold text-slate-700 mb-2">Collectability</div>
              <div className="text-xs text-slate-600">
                <code className="bg-slate-100 px-1 rounded">= Overall Score</code>
              </div>
              <div className="text-xs text-slate-500 mt-2">Direct mapping</div>
            </div>
          </div>
        ) : (
          // Edit mode
          <div className="space-y-6 mt-4">
            {/* Risk Tiers Editor */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Risk Tiers</label>
              <div className="space-y-2">
                {calcSettings.riskTiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white p-3 rounded border">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => {
                        const newTiers = [...calcSettings.riskTiers]
                        newTiers[index].name = e.target.value
                        setCalcSettings({ ...calcSettings, riskTiers: newTiers })
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm"
                      placeholder="Tier name"
                    />
                    <label className="text-xs text-slate-600 whitespace-nowrap">Min Score:</label>
                    <input
                      type="number"
                      value={tier.min}
                      onChange={(e) => {
                        const newTiers = [...calcSettings.riskTiers]
                        newTiers[index].min = parseFloat(e.target.value) || 0
                        setCalcSettings({ ...calcSettings, riskTiers: newTiers })
                      }}
                      className="w-20 px-3 py-1.5 border border-slate-300 rounded text-sm"
                      min="0"
                      max="100"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase Value Editor */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Purchase Value Range</label>
              <div className="flex items-center gap-4 bg-white p-4 rounded border">
                <div className="flex-1">
                  <label className="block text-xs text-slate-600 mb-1">Minimum (0 score)</label>
                  <input
                    type="number"
                    value={calcSettings.purchaseValueMin}
                    onChange={(e) => setCalcSettings({ ...calcSettings, purchaseValueMin: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-600 mb-1">Maximum (100 score)</label>
                  <input
                    type="number"
                    value={calcSettings.purchaseValueMax}
                    onChange={(e) => setCalcSettings({ ...calcSettings, purchaseValueMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                </div>
                <div className="text-sm text-slate-600">
                  Formula: <code className="bg-slate-100 px-2 py-1 rounded">
                    {calcSettings.purchaseValueMin} + (score/100 × {(calcSettings.purchaseValueMax - calcSettings.purchaseValueMin).toFixed(2)})
                  </code>
                </div>
              </div>
            </div>

            {/* Save/Reset buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setCalcSettings({
                    riskTiers: [
                      { name: 'Excellent', min: 80, color: 'green' },
                      { name: 'Good', min: 60, color: 'blue' },
                      { name: 'Fair', min: 40, color: 'yellow' },
                      { name: 'Poor', min: 20, color: 'orange' },
                      { name: 'Critical', min: 0, color: 'red' }
                    ],
                    purchaseValueMin: 0.10,
                    purchaseValueMax: 0.25,
                    collectabilityFormula: 'score',
                    customCollectabilityFormula: ''
                  })
                  toast('Reset to default settings', 'info')
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
              >
                Reset to Defaults
              </button>
              <button
                onClick={() => {
                  setShowConfigEditor(false)
                  toast('Settings saved (in-memory only)', 'success')
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Apply Changes
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-blue-600" />
              Scoring Calculator
            </h1>
            <p className="text-sm text-slate-600 mt-1">Test hospital scoring with live KPI inputs and scenarios</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCalculate}
              disabled={calculating || Object.keys(inputs).length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              {calculating ? 'Calculating...' : 'Calculate Score'}
            </button>
            {result && (
              <button
                onClick={exportResults}
                className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Test Scenarios */}
          {testScenarios.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Test Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {testScenarios.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => loadScenario(scenario.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedScenario === scenario.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{scenario.name}</div>
                    <div className="text-xs text-slate-600 mt-1">{scenario.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* KPI Inputs */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">KPI Inputs</h3>
            <div className="space-y-6">
              {Object.entries(kpisByCategory).map(([category, categoryKpis]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">{category}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryKpis.map(kpi => {
                      // Derive variable name from KPI name (snake_case)
                      const varName = kpi.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
                      return (
                        <div key={kpi.id}>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            {kpi.name}
                            <span className="text-slate-500 ml-1">({kpi.unit})</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={inputs[varName] ?? ''}
                            onChange={e => setInputs(prev => ({ ...prev, [varName]: Number(e.target.value) }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={kpi.benchmark_range ? `${kpi.benchmark_range.low}-${kpi.benchmark_range.high}` : ''}
                          />
                          <p className="text-xs text-slate-500 mt-1">{kpi.definition}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {result ? (
            <>
              {/* Overall Score */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
                <div className="text-sm font-medium opacity-90">Overall Score</div>
                <div className="text-5xl font-bold mt-2">{result.overall_score.toFixed(1)}</div>
                <div className="text-sm opacity-90 mt-1">out of 100</div>
                {result.risk_tier && (
                  <div className="mt-4 pt-4 border-t border-blue-500">
                    <div className="text-sm font-medium opacity-90">Risk Tier</div>
                    <div className="text-2xl font-bold mt-1">{result.risk_tier}</div>
                  </div>
                )}
              </div>

              {/* Metrics */}
              {scoringConfig && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Computed Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Collectability Index</span>
                      <span className="font-semibold text-slate-900">{result.collectability_index}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Purchase Value</span>
                      <span className="font-semibold text-slate-900">${result.recommended_purchase_value?.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Confidence Level</span>
                      <span className={`font-semibold ${
                        result.confidence_level === 'High' ? 'text-green-600' :
                        result.confidence_level === 'Medium' ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {result.confidence_level}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Scores */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Category Scores</h3>
                <div className="space-y-3">
                  {Object.entries(result.category_scores).map(([cat, score]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{cat}</span>
                        <span className="text-sm font-semibold text-slate-900">{score.toFixed(1)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${score}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI Details */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">KPI Breakdown</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.kpi_scores.map(kpi => (
                    <div key={kpi.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{kpi.name}</div>
                        <div className="text-xs text-slate-500">{kpi.category}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">{(kpi.score * 100).toFixed(0)}</div>
                          <div className="text-xs text-slate-500">w: {kpi.weight.toFixed(2)}</div>
                        </div>
                        {kpi.score >= 0.8 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : kpi.score >= 0.5 ? (
                          <TrendingUp className="w-4 h-4 text-amber-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Enter KPI values and click Calculate to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
