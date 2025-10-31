import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Parser } from 'expr-eval'

type Weights = Record<string, number>
const defaultWeights: Weights = {
  recovery_rate: 0.2,
  statute_months: 0.15,
  self_pay_percent: 0.1,
  zip_income: 0.1,
  debt_age: 0.2,
  number_of_beds: 0.05,
}

const defaultParams = {
  recovery_rate_max_percent: 10,
  statute_months_max: 24,
  self_pay_percent_max: 100,
  zip_income_cap: 100000,
  debt_age_max_days: 365,
  number_of_beds_cap: 1000,
  output_scale_max: 5,
  risk_low_min: 4,
  risk_medium_min: 3,
  purchase_min: 0.10,
  purchase_max: 0.25,
}

type Params = typeof defaultParams

type FactorDef = {
  id: keyof Weights
  label: string
  field: 'recovery_rate' | 'statute_months' | 'self_pay_percent' | 'zip_income' | 'debt_age' | 'number_of_beds'
  mode: 'direct' | 'inverse'
  capParam: keyof Params
}

const defaultFactors: FactorDef[] = [
  { id: 'recovery_rate', label: 'Recovery rate', field: 'recovery_rate', mode: 'direct', capParam: 'recovery_rate_max_percent' },
  { id: 'statute_months', label: 'Statute months', field: 'statute_months', mode: 'direct', capParam: 'statute_months_max' },
  { id: 'self_pay_percent', label: 'Self-pay percent', field: 'self_pay_percent', mode: 'inverse', capParam: 'self_pay_percent_max' },
  { id: 'zip_income', label: 'ZIP income', field: 'zip_income', mode: 'direct', capParam: 'zip_income_cap' },
  { id: 'debt_age', label: 'Debt age', field: 'debt_age', mode: 'inverse', capParam: 'debt_age_max_days' },
  { id: 'number_of_beds', label: 'Number of beds', field: 'number_of_beds', mode: 'direct', capParam: 'number_of_beds_cap' },
]

// Heuristic default description for unknown keys (beginner-friendly, neutral wording)
function generateDescriptionFromKey(key: string): string {
  const pretty = key.replace(/_/g, ' ').trim()
  const lower = key.toLowerCase()
  // Domain-specific patterns first (beginner-friendly)
  if (/(geo|geograph|region|state|locale|zip)/i.test(lower)) {
    return 'Geographic mix: where patients or sites are located. Different states/regions have different payer rules and income levels, which affects collections.'
  }
  if (/payer|payor/.test(lower)) {
    return 'Payer mix: who pays the bills (commercial, Medicare, Medicaid, self-pay). Some payers pay more and faster than others.'
  }
  if (/phi|hipaa|privacy|compliance/.test(lower)) {
    return 'PHI/HIPAA compliance: how well patient data is protected. Better compliance lowers legal and financial risk.'
  }
  if (/centraliz/.test(lower)) {
    return 'Centralization: how much billing/IT/decisions are managed centrally. More centralization usually makes rollout and management easier.'
  }
  if (/\bemr\b|electronic.*medical.*record/.test(lower)) {
    return 'EMR system quality: reliability, completeness, and integration of the medical record. Better EMR reduces errors and speeds cash.'
  }
  if (/denial/.test(lower)) {
    return 'Denial rate: percent of claims rejected at first. Lower is better because denials slow cash and add rework.'
  }
  if (/self[_\s-]?pay/.test(lower)) {
    return 'Self-pay percentage: share of bills paid by patients directly. Higher self-pay is harder to collect.'
  }
  if (/operating.*margin|margin/.test(lower)) {
    return 'Operating margin: profitability from normal operations. Higher margins usually mean stronger, lower-risk partners.'
  }
  if (/length[_\s-]?of[_\s-]?stay|alos/.test(lower)) {
    return 'Average length of stay: average inpatient days. Very high can signal issues; context matters by specialty.'
  }
  if (/case[_\s-]?mix|cmi/.test(lower)) {
    return 'Case Mix Index (CMI): average clinical complexity. Higher can mean higher reimbursement but also higher denial risk.'
  }
  if (/occupancy/.test(lower)) {
    return 'Occupancy rate: percent of beds filled. Extremely high or low can add operational risk.'
  }
  if (/aging|over[_\s-]?180|>\s*180/.test(lower)) {
    return 'Aging over 180 days: share of balances older than 180 days. Older balances are harder to collect.'
  }
  if (/in[_\s-]?network/.test(lower)) {
    return 'In-network percentage: share of services with contracted payers. In-network claims are more predictable.'
  }
  // Generic patterns
  if (/rate$/i.test(lower)) return `${pretty}: how often this happens. The weight sets how much it matters.`
  if (/percent|percentage$/i.test(lower)) return `${pretty}: the share (in %). The weight sets its importance.`
  if (/amount|balance|size|value$/i.test(lower)) return `${pretty}: the typical size/amount. The weight controls its impact on the score.`
  if (/quality|score|index$/i.test(lower)) return `${pretty}: a quality/score measure. Higher is usually better; the weight sets its influence.`
  if (/months|days|years|age$/i.test(lower)) return `${pretty}: a time-based measure. The weight controls how much timing affects the score.`
  if (/count|number|volume$/i.test(lower)) return `${pretty}: a quantity/count. The weight sets how much it matters.`
  if (/income|revenue/.test(lower)) return `${pretty}: a financial measure. The weight changes how strongly it influences the score.`
  return `${pretty}: a factor in your score. The weight controls how important it is.`
}

export default function ScoringWeightsEditor() {
  const [weights, setWeights] = useState<Weights>(defaultWeights)
  const [weightsSaved, setWeightsSaved] = useState<Weights>(defaultWeights)
  const [params, setParams] = useState<Params>(defaultParams)
  const [factors, setFactors] = useState<FactorDef[]>(defaultFactors)
  const [customParams, setCustomParams] = useState<Record<string, number>>({})
  const DEFAULT_DESCRIPTIONS: Record<string,string> = {
    recovery_rate: 'Higher recovery rate yields higher score.',
    statute_months: 'More months remaining until statute improves score.',
    self_pay_percent: 'Lower self-pay percentage is better.',
    zip_income: 'Higher area income tends to correlate with better outcomes.',
    debt_age: 'Newer (younger) debt ages score higher.',
    number_of_beds: 'More beds can indicate larger, more stable facilities.',
    // Common additional fields we see
    centralization: 'How centralized the health system is (central billing/decision-making). More centralization often makes contracting and rollout simpler.',
    emr_system_quality: 'Quality of the electronic medical record (EMR): data completeness, integration, reliability. Higher quality usually improves throughput and accuracy.',
    emr_quality: 'Quality of the electronic medical record (EMR): data completeness, integration, reliability. Higher quality usually improves throughput and accuracy.',
    denial_rate: 'Percentage of claims initially denied. Lower denial rates are better.',
    average_claim_amount: 'Typical claim size. Depending on your strategy, larger claims may be more or less attractive.',
    payer_mix_quality: 'How favorable the payer mix is (e.g., commercial vs. self-pay). Higher is better.',
    readmission_rate: 'Rate of patient readmissions. Lower is better and can indicate better outcomes and processes.',
    bad_debt_rate: 'Portion of uncollectible accounts. Lower is better.',
    charity_care_policy: 'Strictness of charity care or financial assistance policies. Less restrictive policies may reduce collectible balances.',
    staffing_ratio: 'Staffing adequacy (e.g., staff per bed). Better staffing may correlate with smoother operations.',
    outpatient_percentage: 'Share of outpatient vs. inpatient. Depending on your model, one may be preferred.',
    cash_reserves_days: 'How many days the hospital can operate using cash on hand. More indicates stronger stability.',
    operating_margin: 'Operating profit margin. Higher margins usually indicate better financial health.',
    case_mix_index: 'Overall clinical complexity and resource intensity of patients. Higher means more complex cases.',
    average_length_of_stay: 'Average days a patient stays. Lower can indicate efficiency; context matters by specialty.',
    occupancy_rate: 'Percentage of beds that are occupied. Very high or very low can affect operations and cash flow.',
    discharge_volume: 'Number of discharges over a period. Higher volumes can indicate scale and stable throughput.',
    referral_network_strength: 'Strength of referral relationships. Strong networks can improve patient flow and collections.',
    market_share: 'Share of the local market. Higher share can correlate with stability and leverage.',
    rurality_index: 'How rural the service area is. Rural markets can have different payer mixes and logistics.',
    teaching_status: 'Whether the hospital is a teaching institution. This can affect complexity and reimbursement patterns.',
    accreditation_status: 'Accreditations (e.g., Joint Commission). Indicates quality processes and compliance.',
    billing_system_maturity: 'How mature the billing system/process is. Mature systems mean fewer errors and faster collections.',
    it_integration_score: 'How well systems are integrated (EMR, billing, clearinghouse). Better integration improves throughput.',
    compliance_score: 'Adherence to regulatory and internal policies. Better compliance lowers risk.',
    coding_accuracy: 'Accuracy of medical coding. Better coding reduces denials and speeds payments.',
    claims_submission_speed: 'How quickly claims are sent. Faster submission shortens revenue cycles.',
    follow_up_speed: 'How quickly denials or AR are followed up. Faster follow-up improves recovery.',
    patient_portal_adoption: 'How many patients use the portal. Better adoption can improve payments and communications.',
    collections_team_capacity: 'Staffing and tools in collections. More capacity can raise recovery rates.',
    in_network_percentage: 'How much care is in-network. In-network care tends to have more predictable reimbursement.',
    medicaid_percentage: 'Share of Medicaid. Higher Medicaid can reduce average collections versus commercial.',
    medicare_percentage: 'Share of Medicare. Impacts reimbursement patterns and timing.',
    commercial_percentage: 'Share of commercial insurance. Often associated with better reimbursement.',
    self_pay_percentage: 'Share of self-pay patients. Higher self-pay can increase collection difficulty.',
    out_of_state_percentage: 'Share of out-of-state patients. Can affect payer rules and collections logistics.',
    legal_risk_index: 'Risk of litigation or legal exposure. Higher risk can reduce attractiveness.',
    aging_balance_over_180: 'Portion of AR older than 180 days. Higher aging usually lowers collectability.',
    small_balance_percentage: 'Share of small balances. Many small balances can be costly to pursue.',
    large_balance_percentage: 'Share of large balances. Large balances can be attractive but may carry risk.',
    number_of_locations: 'How many sites/clinics are in the system. More locations may increase scale and complexity.',
    number_of_providers: 'Number of active providers. More providers can increase volume and require robust systems.',
    specialty_mix_diversity: 'How diverse the specialties are. Diversity can smooth revenue cycles across seasons.',
    trauma_level: 'Trauma center designation (e.g., Level I–IV). Higher levels treat complex cases and affect reimbursements.',
    icu_capacity: 'ICU bed availability. More capacity often signals ability to handle high-acuity cases.',
    charity_care_rate: 'Share of care provided at reduced/no cost. Higher rates lower collectible balances.',
    uncompensated_care_rate: 'Care provided without payment. Higher rates reduce overall collections.',
    payer_dispute_rate: 'How often payers dispute claims. Higher dispute rates slow cash and increase cost.',
    authorization_denial_rate: 'How often services lack required authorizations. Higher rates lead to denials.',
    clinical_documentation_quality: 'Completeness and clarity of clinical documentation. Better documentation means fewer denials.',
    data_sharing_readiness: 'Ability to share data securely with partners. Better readiness improves integrations.',
    contract_flexibility: 'How flexible the partner is in contracting. More flexibility speeds onboarding.',
    decision_making_speed: 'How quickly leadership makes decisions. Faster decisions shorten time-to-value.',
    leadership_stability: 'Consistency of leadership team. Stability reduces project risk.',
    integration_readiness: 'Readiness to integrate new processes/partners. Higher readiness shortens rollout time.',
  }
  const [weightsDesc, setWeightsDesc] = useState<Record<string,string>>({})
  const [weightsDescSaved, setWeightsDescSaved] = useState<Record<string,string>>({})
  const [formulaWeighted, setFormulaWeighted] = useState<string>(
    '((min(recovery_rate/p_recovery_rate_max_percent,1)*w_recovery_rate)+'+
    '(min(statute_months/p_statute_months_max,1)*w_statute_months)+'+
    '((1-min(self_pay_percent/p_self_pay_percent_max,1))*w_self_pay_percent)+'+
    '(min(zip_income/p_zip_income_cap,1)*w_zip_income)+'+
    '((1-min(debt_age/p_debt_age_max_days,1))*w_debt_age)+'+
    '(min(number_of_beds/p_number_of_beds_cap,1)*w_number_of_beds))'+
    '/(w_recovery_rate+w_statute_months+w_self_pay_percent+w_zip_income+w_debt_age+w_number_of_beds)*p_output_scale_max'
  )
  const [formulaPurchase, setFormulaPurchase] = useState<string>('p_purchase_min + (weighted_score/p_output_scale_max)*(p_purchase_max - p_purchase_min)')
  const [formulaRisk, setFormulaRisk] = useState<string>('if(weighted_score>=p_risk_low_min,2, if(weighted_score>=p_risk_medium_min,1,0))')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  // Parameter calculators (fully custom): name, description, expression, enabled
  type ParamCalc = { name: string; description: string; expression: string; enabled: boolean; weight: number }
  const [paramCalcs, setParamCalcs] = useState<ParamCalc[]>([])
  const [paramCalcsSaved, setParamCalcsSaved] = useState<ParamCalc[]>([])

  useEffect(() => {
    ;(async () => {
      const ref = doc(db, 'config', 'scoringWeights')
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data() as any
        // Prefer nested weights map; fallback to legacy flat numeric keys
        if (data.weights && typeof data.weights === 'object') {
          const w: Weights = {}
          const reservedInWeights = new Set<string>(['version'])
          Object.entries(data.weights).forEach(([k, v]) => {
            const key = String(k)
            if (!reservedInWeights.has(key)) {
              w[key] = Number(v as any)
            }
          })
          const picked = Object.keys(w).length ? w : defaultWeights
          setWeights(picked)
          setWeightsSaved(picked)
        } else {
          // Legacy support: pick numeric top-level keys but ignore reserved/meta keys like 'version'
          const reserved = new Set<string>([...Object.keys(defaultParams), 'version', 'weights', 'weights_descriptions', 'custom_params', 'factors', 'formula_weighted_score', 'formula_purchase', 'formula_risk_score'])
          const w: Weights = {}
          for (const [k, v] of Object.entries(data)) {
            const key = String(k)
            if (typeof v === 'number' && !key.startsWith('p_') && !key.startsWith('formula_') && !reserved.has(key)) {
              w[key] = Number(v)
            }
          }
          const picked = Object.keys(w).length ? w : defaultWeights
          setWeights(picked)
          setWeightsSaved(picked)
        }
        setParams({ ...defaultParams, ...data })
        // Load weight descriptions (optional) and ensure every current weight has one
        const descs: Record<string,string> = {}
        if (data.weights_descriptions && typeof data.weights_descriptions === 'object') {
          Object.entries(data.weights_descriptions).forEach(([k,v]) => { descs[String(k)] = String(v ?? '') })
        }
        const currentWeights = data.weights && typeof data.weights === 'object'
          ? Object.keys(data.weights).filter((k: any) => k !== 'version')
          : Object.keys(typeof data === 'object' ? data : {})
              .filter((k: any) => typeof (data as any)[k] === 'number')
        const filled: Record<string,string> = { ...DEFAULT_DESCRIPTIONS, ...descs }
        for (const k of currentWeights) {
          if (!filled[k] || !filled[k].trim()) filled[k] = (DEFAULT_DESCRIPTIONS[k] ?? generateDescriptionFromKey(k))
        }
        setWeightsDesc(filled)
        setWeightsDescSaved(filled)
        if (data.custom_params && typeof data.custom_params === 'object') {
          const cp: Record<string, number> = {}
          Object.entries(data.custom_params).forEach(([k, v]) => cp[k] = Number(v as any))
          setCustomParams(cp)
        }
        if (Array.isArray(data.factors) && data.factors.length) {
          const merged = data.factors.map((f: any) => ({
            id: f.id as keyof Weights,
            label: String(f.label ?? f.id),
            field: f.field as FactorDef['field'],
            mode: (f.mode === 'inverse' ? 'inverse' : 'direct') as FactorDef['mode'],
            capParam: f.capParam as keyof Params,
          })) as FactorDef[]
          setFactors(merged)
        }
        if (typeof data.formula_weighted_score === 'string') setFormulaWeighted(data.formula_weighted_score)
        if (typeof data.formula_purchase === 'string') setFormulaPurchase(data.formula_purchase)
        if (typeof data.formula_risk_score === 'string') setFormulaRisk(data.formula_risk_score)

        // Load parameter calculators if present
        // Build parameter rows from params_list + weights map (weight lives here now)
        const weightMap: Record<string, number> = (data.weights && typeof data.weights==='object') ? Object.fromEntries(Object.entries(data.weights).map(([k,v])=>[String(k), Number(v as any)])) : {}
        const descMap: Record<string, string> = (data.weights_descriptions && typeof data.weights_descriptions==='object') ? Object.fromEntries(Object.entries(data.weights_descriptions).map(([k,v])=>[String(k), String(v ?? '')])) : {}
        const seen = new Set<string>()
        const rows: ParamCalc[] = []
        if (Array.isArray(data.params_list)) {
          for (const r of data.params_list) {
            const name = String(r.name ?? '')
            if (!name) continue
            seen.add(name)
            rows.push({
              name,
              description: String(r.description ?? descMap[name] ?? ''),
              expression: String(r.expression ?? ''),
              enabled: Boolean(r.enabled ?? true),
              weight: Number(weightMap[name] ?? 0),
            })
          }
        }
        // Include any weights that didn't have a params_list row yet
        for (const [k, v] of Object.entries(weightMap)) {
          if (seen.has(k)) continue
          rows.push({ name: k, description: descMap[k] ?? generateDescriptionFromKey(k), expression: '', enabled: true, weight: Number(v||0) })
        }
        if (rows.length) {
          setParamCalcs(rows)
          setParamCalcsSaved(rows)
        }
      }
    })()
  }, [])

  // Ensure every weight has a description; fill in sensible defaults when missing
  useEffect(() => {
    setWeightsDesc(prev => {
      const next = { ...prev }
      for (const k of Object.keys(weights)) {
        const current = (next[k] ?? '').trim()
        if (!current) {
          next[k] = (DEFAULT_DESCRIPTIONS[k] ?? generateDescriptionFromKey(k)) as string
        }
      }
      // Remove descriptions for deleted weights to keep doc clean
      for (const dk of Object.keys(next)) {
        if (!(dk in weights) && !(dk in DEFAULT_DESCRIPTIONS)) {
          delete (next as any)[dk]
        }
      }
      return next
    })
  }, [weights])

  // Helper equality checks (only for weights and their descriptions)
  function equalWeights(a: Weights, b: Weights): boolean {
    const ak = Object.keys(a).sort()
    const bk = Object.keys(b).sort()
    if (ak.length !== bk.length) return false
    for (let i=0;i<ak.length;i++) if (ak[i] !== bk[i]) return false
    for (const k of ak) if (Number(a[k] ?? 0) !== Number(b[k] ?? 0)) return false
    return true
  }
  function equalDescsForKeys(a: Record<string,string>, b: Record<string,string>, keys: string[]): boolean {
    for (const k of keys) {
      const av = (a[k] ?? '').trim()
      const bv = (b[k] ?? '').trim()
      if (av !== bv) return false
    }
    return true
  }
  const weightsDirty = useMemo(() => {
    // Weights derived from paramCalcs; treat any paramCalcs change affecting weights/descriptions as dirty
    const derivedWeights: Weights = Object.fromEntries(paramCalcs.filter(r=>r.enabled).map(r=>[r.name, r.weight]))
    const baseline: Weights = Object.fromEntries(paramCalcsSaved.filter(r=>r.enabled).map(r=>[r.name, r.weight]))
    const descsNow: Record<string,string> = Object.fromEntries(paramCalcs.map(r=>[r.name, r.description]))
    const descsSaved: Record<string,string> = Object.fromEntries(paramCalcsSaved.map(r=>[r.name, r.description]))
    return !equalWeights(derivedWeights, baseline) || !equalDescsForKeys(descsNow, descsSaved, Array.from(new Set([...Object.keys(descsNow), ...Object.keys(descsSaved)])))
  }, [paramCalcs, paramCalcsSaved])

  // Dirty state for parameter calculators
  const paramCalcsDirty = useMemo(() => {
    if (paramCalcs.length !== paramCalcsSaved.length) return true
    const a = [...paramCalcs].map(r => ({...r})).sort((x,y)=>x.name.localeCompare(y.name))
    const b = [...paramCalcsSaved].map(r => ({...r})).sort((x,y)=>x.name.localeCompare(y.name))
    for (let i=0;i<a.length;i++) {
      const x = a[i], y = b[i]
      if (x.name !== y.name) return true
      if ((x.description??'') !== (y.description??'')) return true
      if ((x.expression??'') !== (y.expression??'')) return true
      if (Boolean(x.enabled) !== Boolean(y.enabled)) return true
      if (Number(x.weight||0) !== Number(y.weight||0)) return true
    }
    return false
  }, [paramCalcs, paramCalcsSaved])

  // Generate a weighted-score formula preview from parameter calculators and current weights
  const generatedWeightedFormula = useMemo(() => {
    const active = paramCalcs.filter(r => r.enabled && r.name.trim() && r.expression.trim() && Number(r.weight||0) > 0)
    if (active.length === 0) return formulaWeighted
    const numerators = active.map(r => `(${r.expression})*w_${r.name}`)
    const denominators = active.map(r => `w_${r.name}`)
    // Multiply by p_output_scale_max if available; fall back to 1 if missing (runtime will handle)
    const expr = `(${numerators.join('+')})/(${denominators.join('+')})*p_output_scale_max`
    return expr
  }, [paramCalcs, formulaWeighted])

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
  const ref = doc(db, 'config', 'scoringWeights')
      // Build weights and descriptions from parameter rows
      const outWeights: Weights = {}
      const outDescs: Record<string,string> = {}
      for (const r of paramCalcs) {
        if (!r.name.trim()) continue
        outWeights[r.name] = Number(r.weight||0)
        outDescs[r.name] = r.description ?? ''
      }
      await setDoc(ref, {
        ...params,
        weights: outWeights,
        weights_descriptions: outDescs,
        // custom_params retained for compatibility but params_list is preferred now
        custom_params: customParams,
        params_list: paramCalcs,
        factors,
        // Prefer the generated formula when params_list exists, else keep manual
        formula_weighted_score: paramCalcs.length ? generatedWeightedFormula : formulaWeighted,
        formula_purchase: formulaPurchase,
        formula_risk_score: formulaRisk,
      }, { merge: true })

      // Cleanup legacy numeric keys like 'version' at the top level
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data() as any
        const reserved = new Set<string>([...Object.keys(defaultParams), 'weights', 'weights_descriptions', 'custom_params', 'factors', 'formula_weighted_score', 'formula_purchase', 'formula_risk_score'])
        const deletes: Record<string, any> = {}
        for (const [k, v] of Object.entries(data)) {
          const key = String(k)
          if (typeof v === 'number' && !key.startsWith('p_') && !key.startsWith('formula_') && !reserved.has(key)) {
            // This looks like a legacy top-level numeric (e.g., 'version'); remove it
            deletes[key] = deleteField()
          }
        }
        if (Object.keys(deletes).length) {
          await setDoc(ref, deletes, { merge: true })
        }
      }
      // Reset dirty baseline to the saved values
      setWeightsSaved(weights)
      setWeightsDescSaved(weightsDesc)
      // Reset dirty baselines
  setWeightsSaved(outWeights)
  setWeightsDescSaved(outDescs)
      setParamCalcsSaved(paramCalcs)
      setStatus('Saved')
    } catch (e: any) {
      setStatus(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const nameOk = (name: string) => /^\w+$/.test(name)
  function addWeight() {
    const base = 'weight'
    let i = 1
    const keys = new Set(Object.keys(weights).map(k => k.toLowerCase()))
    let key = `${base}${i}`
    while (keys.has(key.toLowerCase())) { i++; key = `${base}${i}` }
    setWeights(w => ({ ...w, [key]: 0 }))
    setWeightsDesc(d => ({ ...d, [key]: 'Describe what this weight controls.' }))
  }
  function renameWeight(oldKey: string, newKey: string, setError: (s: string|null)=>void) {
    newKey = newKey.trim()
    if (!newKey || newKey === oldKey) return
    if (!nameOk(newKey)) { setError('Use letters, numbers, underscore only'); return }
    const lower = newKey.toLowerCase()
    const exists = Object.keys(weights).some(k => k.toLowerCase() === lower)
    if (exists) { setError('Name must be unique'); return }
    setWeights(w => {
      const {[oldKey]: val, ...rest} = w
      return { ...rest, [newKey]: val ?? 0 }
    })
    setWeightsDesc(d => {
      const { [oldKey]: dval, ...rest } = d
      return { ...rest, [newKey]: dval ?? '' }
    })
    setError(null)
  }
  function updateWeightValue(key: string, val: number) {
    if (Number.isNaN(val) || val < 0) return
    setWeights(w => ({ ...w, [key]: val }))
  }
  function removeWeight(key: string) {
    setWeights(w => { const { [key]: _, ...rest } = w; return rest })
    setWeightsDesc(d => { const { [key]: __, ...rest } = d; return rest })
  }
  function updateParam(key: keyof Params, val: number) {
    setParams(p => ({ ...p, [key]: val }))
  }
  function addCustomParam() {
    const base = 'param'
    let i = 1
    let key = `${base}${i}`
    const keys = new Set(Object.keys(customParams))
    while (keys.has(key)) { i++; key = `${base}${i}` }
    setCustomParams(p => ({ ...p, [key]: 0 }))
  }
  function updateCustomParam(k: string, v: number) {
    setCustomParams(p => ({ ...p, [k]: v }))
  }
  function renameCustomParam(oldKey: string, newKey: string) {
    if (!newKey || newKey === oldKey) return
    // simple validation: letters, numbers, underscore
    if (!/^\w+$/.test(newKey)) return
    setCustomParams(p => {
      if (p[newKey] !== undefined) return p
      const { [oldKey]: val, ...rest } = p
      return { ...rest, [newKey]: val }
    })
  }
  function removeCustomParam(k: string) {
    setCustomParams(p => {
      const { [k]: _, ...rest } = p
      return rest
    })
  }
  function updateFactor(idx: number, patch: Partial<FactorDef>) {
    setFactors(arr => arr.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded p-3 text-sm">
        <div className="font-medium mb-1">What is a weight?</div>
        <p>
          A weight is the importance of a factor in your score. We normalize all weights so they add up to 100%.
          If one factor has twice the weight of another, it influences the final score twice as much. You don’t need
          to use exact percentages—just set relative importance. The bars below show each factor’s share of 100%.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Parameters</h2>
        <div className="flex items-center gap-2">
          {(weightsDirty || paramCalcsDirty) && (
            <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          )}
        </div>
      </div>
      {status && <p className="text-sm text-slate-600">{status}</p>}
      <p className="text-xs text-slate-500">Weights are normalized automatically; proportions matter, not exact numbers.</p>

  {/* Normalized distribution */}
  <WeightsDistribution weights={Object.fromEntries(paramCalcs.filter(r=>r.enabled).map(r=>[r.name, Number(r.weight||0)]))} />

      {/* Parameter calculators */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Parameter Calculators</h3>
          <button onClick={() => {
            const base = 'factor'
            let i = 1
            const names = new Set(paramCalcs.map(r=>r.name.toLowerCase()))
            let key = `${base}${i}`
            while (names.has(key.toLowerCase())) { i++; key = `${base}${i}` }
            setParamCalcs(rows => [...rows, { name: key, description: generateDescriptionFromKey(key), expression: '0', enabled: true, weight: 0 }])
          }} className="text-blue-700 underline text-sm">Add parameter</button>
        </div>
        <div className="space-y-2">
          {paramCalcs.length === 0 && <div className="text-sm text-slate-500">No parameters yet</div>}
          {paramCalcs.sort((a,b)=>a.name.localeCompare(b.name)).map((row, idx) => (
            <div key={row.name+idx} className="bg-slate-50 rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input className="border rounded p-2 w-48" value={row.name}
                  onChange={e => {
                    const v = e.target.value
                    setParamCalcs(list => list.map((r,i)=> i===idx ? { ...r, name: v } : r))
                  }} />
                <input type="number" min={0} step="0.01" className="border rounded p-2 w-28 text-right" value={row.weight}
                  onChange={e => setParamCalcs(list => list.map((r,i)=> i===idx ? { ...r, weight: Number(e.target.value) } : r))} />
                <span className="text-xs text-slate-600">weight</span>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={row.enabled} onChange={e=> setParamCalcs(list => list.map((r,i)=> i===idx ? { ...r, enabled: e.target.checked } : r))} />
                  Enabled
                </label>
                <button className="text-red-600 underline ml-auto" onClick={() => setParamCalcs(list => list.filter((_,i)=>i!==idx))}>Delete</button>
              </div>
              <input className="border rounded p-2 w-full text-sm" placeholder="Describe what this parameter calculates" value={row.description}
                onChange={e => setParamCalcs(list => list.map((r,i)=> i===idx ? { ...r, description: e.target.value } : r))} />
              <div>
                <div className="text-xs text-slate-600 mb-1">Expression (returns 0..1):</div>
                <textarea className="border rounded p-2 w-full font-mono text-xs min-h-20" value={row.expression}
                  onChange={e => setParamCalcs(list => list.map((r,i)=> i===idx ? { ...r, expression: e.target.value } : r))} />
                <div className="text-[11px] text-slate-500 mt-1">Tip: examples — min(number_of_beds/1000,1), 1 - min(debt_age/365,1). Use hospital fields and basic functions: min, max, clamp, if.</div>
              </div>
            </div>
          ))}
        </div>
        {paramCalcs.length > 0 && (
          <div className="text-xs text-slate-600">
            Generated weighted-score (preview): <span className="font-mono break-all">{generatedWeightedFormula}</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Custom Parameters</h3>
          <button onClick={addCustomParam} className="text-blue-700 underline text-sm">Add parameter</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-right p-2">Value</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(customParams).length === 0 && (
                <tr><td className="p-2 text-slate-500" colSpan={3}>No custom parameters</td></tr>
              )}
              {Object.entries(customParams).map(([k, v]) => (
                <tr key={k} className="border-t">
                  <td className="p-2">
                    <input className="border rounded p-1 w-48" defaultValue={k} onBlur={e => renameCustomParam(k, e.target.value)} />
                    <div className="text-xs text-slate-500">Accessible as {k} and p_{k} in formulas</div>
                  </td>
                  <td className="p-2 text-right">
                    <input type="number" className="border rounded p-1 w-28 text-right" value={v}
                      onChange={e => updateCustomParam(k, Number(e.target.value))} />
                  </td>
                  <td className="p-2">
                    <button className="text-red-600 underline" onClick={() => removeCustomParam(k)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <div className="bg-slate-50 p-3 rounded">
          <h3 className="font-semibold mb-2">Weighted score formula</h3>
          <textarea className="w-full border rounded p-2 font-mono text-xs min-h-24" value={formulaWeighted} onChange={e => setFormulaWeighted(e.target.value)} />
          <p className="text-xs text-slate-600 mt-2">Variables: recovery_rate, statute_months, self_pay_percent, zip_income, debt_age, number_of_beds, w_*, built-in params (p_*), custom params (both name and p_name). Functions: min(a,b), max(a,b), clamp(x,a,b), if(cond,a,b)</p>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <h3 className="font-semibold mb-2">Risk score formula</h3>
          <textarea className="w-full border rounded p-2 font-mono text-xs min-h-20" value={formulaRisk} onChange={e => setFormulaRisk(e.target.value)} />
          <p className="text-xs text-slate-600">Return 2 for Low, 1 for Medium, 0 for High. You can reference weighted_score inside this expression.</p>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <h3 className="font-semibold mb-2">Purchase formula</h3>
          <textarea className="w-full border rounded p-2 font-mono text-xs min-h-20" value={formulaPurchase} onChange={e => setFormulaPurchase(e.target.value)} />
          <p className="text-xs text-slate-600">Should output a number (e.g., 0.18). You can reference weighted_score.</p>
        </div>
      </div>

      {/* Test panel */}
  <TestPanel weights={Object.fromEntries(paramCalcs.filter(r=>r.enabled).map(r=>[r.name, Number(r.weight||0)]))} params={params} customParams={customParams} formulas={{ weighted: paramCalcs.length ? generatedWeightedFormula : formulaWeighted, purchase: formulaPurchase, risk: formulaRisk }} />
    </div>
  )
}

function WeightRow({ name, value, description, onRename, onChangeValue, onChangeDescription, onDelete }: { name: string, value: number, description: string, onRename: (oldKey: string, newKey: string, setError: (s: string|null)=>void)=>void, onChangeValue: (key: string, val: number)=>void, onChangeDescription: (key: string, val: string)=>void, onDelete: (key: string)=>void }) {
  const [localName, setLocalName] = useState(name)
  const [err, setErr] = useState<string|null>(null)
  useEffect(() => { setLocalName(name) }, [name])
  return (
    <div className="text-sm bg-slate-50 p-2 rounded space-y-2">
      <div className="flex items-center gap-2">
        <input className="border rounded p-2 w-full" value={localName}
          placeholder="Weight name (e.g., recovery_rate)"
          onChange={e => { setLocalName(e.target.value); setErr(null) }}
          onBlur={e => onRename(name, e.target.value, setErr)} />
        {err && <span className="text-red-600 text-xs">{err}</span>}
        <input type="number" min={0} step="0.01" className="border rounded p-2 w-28 text-right" value={value}
          placeholder="Value"
          onChange={e => onChangeValue(name, Number(e.target.value))} />
        <button className="text-red-600 underline" onClick={() => onDelete(name)}>Delete</button>
      </div>
      <div>
        <input className="border rounded p-2 w-full" value={description}
          placeholder="Describe what this weight controls"
          onChange={e => onChangeDescription(name, e.target.value)} />
      </div>
    </div>
  )
}

function WeightsDistribution({ weights }: { weights: Weights }) {
  const entries = Object.entries(weights).sort((a,b)=>a[0].localeCompare(b[0]))
  const total = entries.reduce((s,[,v])=>s+Number(v||0),0)
  return (
    <div className="mt-3 bg-slate-50 rounded p-3">
      <div className="text-sm font-medium mb-2">Normalized distribution</div>
      {total <= 0 ? (
        <p className="text-xs text-slate-500">No weights yet</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([k,v]) => {
            const pct = (Number(v||0)/total)*100
            return (
              <div key={k} className="flex items-center gap-2 text-xs">
                <div className="w-32 truncate">{k}</div>
                <div className="flex-1 h-2 bg-white rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-14 text-right">{pct.toFixed(1)}%</div>
              </div>
            )
          })}
          <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-200 mt-2">
            <div className="w-32 font-medium">Total</div>
            <div className="flex-1 h-2 bg-white rounded overflow-hidden">
              <div className="h-full bg-slate-400" style={{ width: '100%' }} />
            </div>
            <div className="w-14 text-right font-medium">100%</div>
          </div>
        </div>
      )}
    </div>
  )
}

function TestPanel({ weights, params, customParams, formulas }: { weights: Weights, params: Params, customParams: Record<string, number>, formulas: { weighted: string, purchase: string, risk: string } }) {
  const [input, setInput] = useState({
    recovery_rate: 8,
    statute_months: 24,
    self_pay_percent: 20,
    zip_income: 60000,
    debt_age: 120,
    number_of_beds: 300,
  })
  const [out, setOut] = useState<{weighted?: number, purchase?: number, riskLabel?: string, error?: string}>({})
  const sumWeights = useMemo(() => Object.values(weights).reduce((a,b)=>a+Number(b||0),0) || 1, [weights])

  function run() {
    try {
      const parser = new Parser()
      const ctx: Record<string, any> = { ...input }
      // weights (dynamic)
      for (const [k,v] of Object.entries(weights)) { (ctx as any)[`w_${k}`] = v }
      // built-in params
      ctx.p_recovery_rate_max_percent = (params as any).recovery_rate_max_percent
      ctx.p_statute_months_max = (params as any).statute_months_max
      ctx.p_self_pay_percent_max = (params as any).self_pay_percent_max
      ctx.p_zip_income_cap = (params as any).zip_income_cap
      ctx.p_debt_age_max_days = (params as any).debt_age_max_days
      ctx.p_number_of_beds_cap = (params as any).number_of_beds_cap
      ctx.p_output_scale_max = (params as any).output_scale_max
      ctx.p_risk_low_min = (params as any).risk_low_min
      ctx.p_risk_medium_min = (params as any).risk_medium_min
      ctx.p_purchase_min = (params as any).purchase_min
      ctx.p_purchase_max = (params as any).purchase_max
      // custom params
      for (const [k,v] of Object.entries(customParams)) { ctx[k]=v; ctx[`p_${k}`]=v }
      // dynamic sum_weights from weights only
      ctx.sum_weights = Object.values(weights).reduce((s,v)=>s+Number(v||0),0) || 1

      const helpers: Record<string, any> = {
        min: (...args: any[]) => Math.min(...args.map(Number)),
        max: (...args: any[]) => Math.max(...args.map(Number)),
        clamp: (x: any, a: any, b: any) => Math.min(Math.max(Number(x), Number(a)), Number(b)),
        if: (cond: any, a: any, b: any) => (cond ? a : b),
      }

      const wExpr = parser.parse(formulas.weighted)
      const weighted = Number(wExpr.evaluate({ ...ctx, ...helpers }))

      const rExpr = parser.parse(formulas.risk)
      const riskScore = Number(rExpr.evaluate({ ...ctx, weighted_score: weighted, ...helpers }))
      const riskLabel = riskScore >= 2 ? 'Low Risk' : riskScore >= 1 ? 'Medium Risk' : 'High Risk'

      const pExpr = parser.parse(formulas.purchase)
      const purchase = Number(pExpr.evaluate({ ...ctx, weighted_score: weighted, ...helpers }))

      setOut({ weighted: Math.round(weighted*100)/100, purchase: Math.round(purchase*100)/100, riskLabel })
    } catch (e: any) {
      setOut({ error: e?.message || 'Eval error' })
    }
  }

  return (
    <div className="mt-8 bg-white rounded-lg shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Test your formulas</h3>
        <button onClick={run} className="bg-blue-600 text-white px-3 py-1 rounded">Evaluate</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['recovery_rate','statute_months','self_pay_percent','zip_income','debt_age','number_of_beds'] as const).map(k => (
          <label key={k} className="text-sm">
            <span className="block capitalize mb-1">{k.split('_').join(' ')}</span>
            <input type="number" className="border rounded p-2 w-full" value={(input as any)[k]}
              onChange={e => setInput(i => ({ ...i, [k]: Number(e.target.value) }))} />
          </label>
        ))}
      </div>
      <div className="text-sm">
        {out.error ? (
          <p className="text-red-600">{out.error}</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            <div>Weighted score: <span className="font-medium">{out.weighted ?? '-'}</span></div>
            <div>Risk: <span className="font-medium">{out.riskLabel ?? '-'}</span></div>
            <div>Purchase: <span className="font-medium">{out.purchase ?? '-'}</span></div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">sum_weights = sum of all variables that start with w_*</p>
    </div>
  )
}
