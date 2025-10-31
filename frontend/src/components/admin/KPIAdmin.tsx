import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { KPI, KpiCategory, KpiRule, MetricType, TrendDirection } from '@/lib/kpiTypes'
import { KPI_CATEGORIES as ALL_CATEGORIES, METRIC_TYPES as ALL_METRIC_TYPES, KPI_UNIT_GROUPS, METRIC_TYPE_TO_UNITS } from '@/lib/kpiTypes'
import { 
  Plus, Save, Search, Settings, ChevronDown, ChevronRight, Trash2, 
  Copy, GripVertical, AlertTriangle, Download, Upload,
  TrendingUp, TrendingDown, Tag, BarChart3, X
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'

type KpiDoc = {
  kpis: KPI[]
}

const CATEGORY_COLORS: Record<KpiCategory, { bg: string; border: string; text: string; badge: string }> = {
  'Financial Performance': { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  'Portfolio Composition': { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  'Operational Efficiency': { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  'Legal & Compliance': { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  'Data Quality': { bg: 'bg-cyan-50', border: 'border-l-cyan-500', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-800' },
  'Ethical / ESG': { bg: 'bg-pink-50', border: 'border-l-pink-500', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800' },
}

function emptyKpi(): KPI {
  const id = `kpi_${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    name: 'New KPI',
    definition: '',
    why_it_matters: '',
    metric_type: 'Financial',
    data_source: '',
    weight: 0.05,
    scoring_rules: [{ condition: 'true', score: 0 }],
    unit: '%',
    category: 'Operational Efficiency',
    trend_direction: 'Higher is better',
    benchmark_range: undefined,
    last_updated: new Date().toISOString(),
    editable_by: 'admin',
    tags: [],
    enabled: true,
  }
}

export default function KPIAdmin() {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [kpisSaved, setKpisSaved] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [expandedKpis, setExpandedKpis] = useState<Set<string>>(new Set())

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const ref = doc(db, 'config', 'kpis')
        const snap = await getDoc(ref)
        if (snap.exists()) {
          const data = snap.data() as Partial<KpiDoc>
          const loaded = Array.isArray(data.kpis) ? (data.kpis as KPI[]) : []
          setKpis(loaded)
          setKpisSaved(loaded)
        } else {
          setKpis([])
          setKpisSaved([])
        }
      } catch (e: any) {
        toast(e.message || 'Failed to load KPIs', 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const isDirty = useMemo(() => {
    return JSON.stringify(kpis) !== JSON.stringify(kpisSaved)
  }, [kpis, kpisSaved])

  const totalWeight = useMemo(() => kpis.filter(k=>k.enabled!==false).reduce((s,k)=>s+Number(k.weight||0),0), [kpis])

  const filteredKpis = useMemo(() => {
    if (!searchTerm) return kpis
    const lower = searchTerm.toLowerCase()
    return kpis.filter(k => 
      k.name.toLowerCase().includes(lower) ||
      k.category.toLowerCase().includes(lower) ||
      k.definition.toLowerCase().includes(lower) ||
      (k.tags || []).some(t => t.toLowerCase().includes(lower))
    )
  }, [kpis, searchTerm])

  async function save() {
    setSaving(true)
    try {
      const ref = doc(db, 'config', 'kpis')
      const out: KpiDoc = { kpis }
      await setDoc(ref, out, { merge: true })
      setKpisSaved(kpis)
      toast('KPIs saved successfully', 'success')
    } catch (e: any) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function wipeLegacyScoring() {
    if (!confirm('This will permanently delete legacy config/scoringWeights. This cannot be undone. Continue?')) return
    try {
      await deleteDoc(doc(db, 'config', 'scoringWeights'))
      toast('Legacy scoring config deleted', 'success')
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error')
    }
  }

  function addKpi() {
    const newKpi = emptyKpi()
    setKpis(list => [...list, newKpi])
    setExpandedKpis(prev => new Set([...prev, newKpi.id]))
  }

  function duplicateKpi(kpi: KPI) {
    const dup = { ...kpi, id: `kpi_${Math.random().toString(36).slice(2, 8)}`, name: `${kpi.name} (copy)` }
    setKpis(list => [...list, dup])
    setExpandedKpis(prev => new Set([...prev, dup.id]))
    toast('KPI duplicated', 'info')
  }

  function exportKpis() {
    const data = JSON.stringify({ kpis }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kpis-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('KPIs exported', 'success')
  }

  function importKpis() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (Array.isArray(data.kpis)) {
          // Merge with existing KPIs instead of replacing
          const existingIds = new Set(kpis.map(k => k.id))
          const newKpis = data.kpis.filter((k: KPI) => !existingIds.has(k.id))
          const updatedKpis = [...kpis, ...newKpis]
          setKpis(updatedKpis)
          toast(`Imported ${newKpis.length} new KPIs (${data.kpis.length - newKpis.length} duplicates skipped)`, 'success')
        } else {
          toast('Invalid KPI file format', 'error')
        }
      } catch (err: any) {
        toast(err.message || 'Import failed', 'error')
      }
    }
    input.click()
  }

  function toggleExpand(id: string) {
    setExpandedKpis(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpandedKpis(new Set(kpis.map(k => k.id)))
  }

  function collapseAll() {
    setExpandedKpis(new Set())
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty && !saving) save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, saving, kpis])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">KPI Configuration</h1>
            <p className="text-sm text-slate-600 mt-1">Define and manage scoring metrics across all categories</p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                <AlertTriangle className="w-3 h-3" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={save}
              disabled={saving || !isDirty}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                    <button onClick={exportKpis} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Download className="w-4 h-4" />
                      Export KPIs
                    </button>
                    <button onClick={importKpis} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <Upload className="w-4 h-4" />
                      Import KPIs
                    </button>
                    <button onClick={expandAll} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <ChevronDown className="w-4 h-4" />
                      Expand all
                    </button>
                    <button onClick={collapseAll} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <ChevronRight className="w-4 h-4" />
                      Collapse all
                    </button>
                    <div className="border-t border-slate-200 my-1"></div>
                    <button onClick={wipeLegacyScoring} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                      Wipe legacy scoring
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search KPIs by name, category, or tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={addKpi}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add KPI
          </button>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
          <span className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            {kpis.filter(k => k.enabled !== false).length} of {kpis.length} enabled
          </span>
          <span>•</span>
          <span>Total weight: {totalWeight.toFixed(2)}</span>
          {searchTerm && (
            <>
              <span>•</span>
              <span>{filteredKpis.length} matching</span>
            </>
          )}
        </div>
      </div>

      {/* Weight Distribution */}
      <WeightDistributionCard kpis={kpis} totalWeight={totalWeight} />

      {/* KPI List */}
      <div className="space-y-3">
        {filteredKpis.length === 0 && !searchTerm && (
          <EmptyState onAdd={addKpi} />
        )}
        {filteredKpis.length === 0 && searchTerm && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No KPIs found</h3>
            <p className="text-sm text-slate-600">Try a different search term or clear the filter</p>
          </div>
        )}
        {filteredKpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            kpi={kpi}
            expanded={expandedKpis.has(kpi.id)}
            onToggle={() => toggleExpand(kpi.id)}
            onChange={patch => setKpis(list => list.map(k => k.id === kpi.id ? { ...k, ...patch, last_updated: new Date().toISOString() } : k))}
            onRemove={() => {
              if (confirm(`Delete "${kpi.name}"?`)) {
                setKpis(list => list.filter(k => k.id !== kpi.id))
                toast('KPI deleted', 'info')
              }
            }}
            onDuplicate={() => duplicateKpi(kpi)}
          />
        ))}
      </div>

      {isDirty && (
        <div className="sticky bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 pointer-events-auto">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">You have unsaved changes</span>
            <button
              onClick={save}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Save now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">No KPIs configured yet</h3>
        <p className="text-sm text-slate-600 mb-6">
          Get started by creating your first KPI. Define scoring rules, weights, and categories to evaluate hospital portfolios.
        </p>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Create your first KPI
        </button>
      </div>
    </div>
  )
}

function WeightDistributionCard({ kpis, totalWeight }: { kpis: KPI[]; totalWeight: number }) {
  const grouped = useMemo(() => {
    const map = new Map<KpiCategory, number>()
    for (const k of kpis) {
      if (k.enabled === false) continue
      map.set(k.category, (map.get(k.category) || 0) + Number(k.weight || 0))
    }
    return Array.from(map.entries()).sort((a,b)=> (b[1] || 0) - (a[1] || 0))
  }, [kpis])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Weight Distribution by Category</h3>
      <div className="space-y-3">
        {grouped.map(([cat, w]) => {
          const pct = totalWeight > 0 ? (w/totalWeight)*100 : 0
          const colors = CATEGORY_COLORS[cat]
          return (
            <div key={cat} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={`font-medium ${colors.text}`}>{cat}</span>
                <span className="text-slate-600">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.border.replace('border-l-', 'bg-')} transition-all duration-300`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          )
        })}
        {grouped.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No enabled KPIs yet</p>
        )}
      </div>
    </div>
  )
}

function KpiCard({ kpi, expanded, onToggle, onChange, onRemove, onDuplicate }: {
  kpi: KPI
  expanded: boolean
  onToggle: () => void
  onChange: (patch: Partial<KPI>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const colors = CATEGORY_COLORS[kpi.category]
  const [showActions, setShowActions] = useState(false)

  function update<K extends keyof KPI>(k: K, v: KPI[K]) { onChange({ [k]: v } as Partial<KPI>) }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-l-4 ${colors.border} border-t border-r border-b border-slate-200 transition-all duration-200 hover:shadow-md ${expanded ? 'ring-2 ring-blue-100' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Collapsed Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            {expanded ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronRight className="w-5 h-5 text-slate-600" />}
          </button>
          <GripVertical className="w-4 h-4 text-slate-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-slate-900 truncate">{kpi.name}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                {kpi.category}
              </span>
              {kpi.metric_type && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {kpi.metric_type}
                </span>
              )}
            </div>
            {!expanded && kpi.definition && (
              <p className="text-sm text-slate-600 truncate">{kpi.definition}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500">Weight</div>
              <div className="text-sm font-semibold text-slate-900">{(kpi.weight || 0).toFixed(2)}</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={kpi.enabled !== false}
                onChange={e => update('enabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600">Enabled</span>
            </label>
            {showActions && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onDuplicate}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={onRemove}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className={`border-t border-slate-200 p-6 space-y-6 ${colors.bg}`}>
          {/* Field order matches user template: name → definition → why_it_matters → category → metric_type → data_source → unit → trend_direction → benchmark_range → weight → editable_by → tags */}
          
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">KPI Name *</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={kpi.name}
                onChange={e => update('name', e.target.value)}
                placeholder="e.g., Recovery Rate"
              />
            </div>

            {/* Definition */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Definition</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                value={kpi.definition}
                onChange={e => update('definition', e.target.value)}
                placeholder="What does this KPI measure?"
              />
            </div>

            {/* Why It Matters */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Why It Matters</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                value={kpi.why_it_matters}
                onChange={e => update('why_it_matters', e.target.value)}
                placeholder="Business impact and relevance"
              />
            </div>

            {/* Category & Metric Type (row) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={kpi.category}
                  onChange={e => update('category', e.target.value as KpiCategory)}
                >
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Metric Type *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={kpi.metric_type}
                  onChange={e => {
                    const newMetricType = e.target.value as MetricType
                    update('metric_type', newMetricType)
                    // Reset unit if current unit is not valid for new metric type
                    const validUnits = METRIC_TYPE_TO_UNITS[newMetricType]
                    if (!validUnits.includes(kpi.unit)) {
                      update('unit', validUnits[0] || '')
                    }
                  }}
                >
                  {ALL_METRIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Data Source */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Data Source</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={kpi.data_source}
                onChange={e => update('data_source', e.target.value)}
                placeholder="e.g., CMS Cost Report, Hospital EMR"
              />
            </div>

            {/* Unit & Trend Direction (row) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Unit *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={kpi.unit}
                  onChange={e => update('unit', e.target.value)}
                >
                  <option value="">Select a unit...</option>
                  {/* Filter units based on selected metric type */}
                  {KPI_UNIT_GROUPS.filter(group => group.group === kpi.metric_type).map(group => (
                    group.units.map(unit => (
                      <option key={unit.value} value={unit.value} title={unit.example}>
                        {unit.label}
                      </option>
                    ))
                  ))}
                </select>
                {kpi.unit && (
                  <p className="text-xs text-slate-500 mt-1">
                    {KPI_UNIT_GROUPS.flatMap(g => g.units).find(u => u.value === kpi.unit)?.example}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Trend Direction</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={kpi.trend_direction}
                  onChange={e => update('trend_direction', e.target.value as TrendDirection)}
                >
                  <option>Higher is better</option>
                  <option>Lower is better</option>
                </select>
              </div>
            </div>

            {/* Benchmark Range & Weight */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Benchmark Range (optional)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={kpi.benchmark_range?.low ?? ''}
                    onChange={e => {
                      const low = e.target.value === '' ? undefined : Number(e.target.value)
                      const high = kpi.benchmark_range?.high
                      update('benchmark_range', low !== undefined || high !== undefined ? { low: low ?? 0, high: high ?? 0 } : undefined)
                    }}
                    placeholder="Low"
                  />
                  <p className="text-xs text-slate-500 mt-1">Low benchmark</p>
                </div>
                <div>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={kpi.benchmark_range?.high ?? ''}
                    onChange={e => {
                      const high = e.target.value === '' ? undefined : Number(e.target.value)
                      const low = kpi.benchmark_range?.low
                      update('benchmark_range', low !== undefined || high !== undefined ? { low: low ?? 0, high: high ?? 0 } : undefined)
                    }}
                    placeholder="High"
                  />
                  <p className="text-xs text-slate-500 mt-1">High benchmark</p>
                </div>
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Weight</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={kpi.weight}
                onChange={e => update('weight', Number(e.target.value))}
              />
              <p className="text-xs text-slate-500 mt-1">Relative importance (0-1)</p>
            </div>

            {/* Editable By (optional field) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Editable By (role)</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={kpi.editable_by || ''}
                onChange={e => update('editable_by', e.target.value || undefined)}
                placeholder="e.g., admin, analyst"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-700 mb-1">
                <Tag className="w-3 h-3" />
                Tags
              </label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={(kpi.tags || []).join(', ')}
                onChange={e => update('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Comma-separated tags for search"
              />
            </div>
          </div>

          {/* Scoring Rules */}
          <ScoringRulesEditor kpi={kpi} onChange={update} />
        </div>
      )}
    </div>
  )
}

function ScoringRulesEditor({ kpi, onChange }: { kpi: KPI; onChange: <K extends keyof KPI>(k: K, v: KPI[K]) => void }) {
  function addRule() {
    onChange('scoring_rules', [...(kpi.scoring_rules || []), { condition: '', score: 0 }])
  }

  function updateRule(i: number, patch: Partial<KpiRule>) {
    const rules = [...kpi.scoring_rules]
    rules[i] = { ...rules[i], ...patch }
    onChange('scoring_rules', rules)
  }

  function removeRule(i: number) {
    onChange('scoring_rules', kpi.scoring_rules.filter((_, idx) => idx !== i))
  }

  // Get the field name from the KPI ID (snake_case version of the name)
  const fieldName = kpi.id || kpi.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  // Parse condition into user-friendly format
  function parseCondition(condition: string): { operator: string; value: string } | null {
    if (!condition) return null
    
    // Match patterns like: field >= value, field == value, etc.
    const patterns = [
      { regex: /^.+?\s*>=\s*(.+)$/, op: '>=' },
      { regex: /^.+?\s*<=\s*(.+)$/, op: '<=' },
      { regex: /^.+?\s*>\s*(.+)$/, op: '>' },
      { regex: /^.+?\s*<\s*(.+)$/, op: '<' },
      { regex: /^.+?\s*==\s*(.+)$/, op: '==' },
      { regex: /^.+?\s*!=\s*(.+)$/, op: '!=' }
    ]
    
    for (const { regex, op } of patterns) {
      const match = condition.match(regex)
      if (match) {
        return { operator: op, value: match[1].trim() }
      }
    }
    return null
  }

  // Build condition from user-friendly inputs
  function buildCondition(operator: string, value: string): string {
    if (!operator || value === '') return ''
    return `${fieldName} ${operator} ${value}`
  }

  const hasErrors = useMemo(() => {
    return kpi.scoring_rules.some(r => !r.condition.trim())
  }, [kpi.scoring_rules])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          Scoring Rules
          {hasErrors && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        </h5>
        <button
          onClick={addRule}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add rule
        </button>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        Create simple scoring rules. For example: "If value is greater than 0.75, score = 5"
      </p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 border-b border-slate-200">
          <div className="grid grid-cols-[180px,140px,100px,60px] gap-3">
            <div>When <strong>{kpi.name}</strong> is...</div>
            <div>This Value</div>
            <div className="text-right">Then Score</div>
            <div></div>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {kpi.scoring_rules.map((r, i) => {
            const parsed = parseCondition(r.condition)
            const operator = parsed?.operator || '>='
            const value = parsed?.value || ''
            const isValid = r.condition.trim()
            
            return (
              <div key={i} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="grid grid-cols-[180px,140px,100px,60px] gap-3 items-start">
                  {/* Operator Dropdown */}
                  <div>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={operator}
                      onChange={e => {
                        const newCondition = buildCondition(e.target.value, value)
                        updateRule(i, { condition: newCondition })
                      }}
                    >
                      <option value=">=">greater than or equal to</option>
                      <option value=">">greater than</option>
                      <option value="<=">less than or equal to</option>
                      <option value="<">less than</option>
                      <option value="==">equals</option>
                      <option value="!=">not equals</option>
                    </select>
                  </div>
                  
                  {/* Value Input */}
                  <div>
                    <input
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={value}
                      onChange={e => {
                        const newCondition = buildCondition(operator, e.target.value)
                        updateRule(i, { condition: newCondition })
                      }}
                      placeholder="0.75"
                    />
                  </div>
                  
                  {/* Score Input */}
                  <div>
                    <input
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={r.score}
                      onChange={e => updateRule(i, { score: Number(e.target.value) })}
                    />
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => removeRule(i)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Plain English Preview */}
                {isValid && (
                  <div className="mt-2 text-xs text-slate-600 bg-blue-50 px-3 py-2 rounded border border-blue-100">
                    ✓ <strong>If {kpi.name}</strong> is <strong>{operator === '>=' ? 'greater than or equal to' : operator === '>' ? 'greater than' : operator === '<=' ? 'less than or equal to' : operator === '<' ? 'less than' : operator === '==' ? 'equal to' : 'not equal to'}</strong> <strong>{value}</strong>, then score = <strong>{r.score}</strong>
                  </div>
                )}
                
                {!isValid && (
                  <p className="text-xs text-red-600 mt-2">⚠️ Please enter a value to complete this rule</p>
                )}
              </div>
            )
          })}
          {kpi.scoring_rules.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No rules defined. Click "Add rule" to create your first scoring rule.
            </div>
          )}
        </div>
      </div>
      
      {/* Helper Guide */}
      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs font-semibold text-blue-900 mb-1">💡 How Scoring Works:</p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
          <li>Add multiple rules for different value ranges</li>
          <li>Rules are checked top-to-bottom - <strong>first match wins!</strong></li>
          <li>Scores can be any number (1-5, 0-100, etc.) - system auto-normalizes</li>
          <li>Example: If {kpi.name} ≥ 0.75 → score 5, if {kpi.name} ≥ 0.5 → score 3</li>
        </ul>
      </div>
    </div>
  )
}
