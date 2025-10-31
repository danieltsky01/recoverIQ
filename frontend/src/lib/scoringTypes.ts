// Types for scoring system configuration

export type RiskTier = {
  name: string
  min: number // minimum score for this tier
  color?: string
}

export type ScoringSystemConfig = {
  risk_tiers: RiskTier[]
  collectability_formula: string // formula to compute collectability index
  purchase_formula: string // formula to compute purchase value
  confidence_formula: string // formula to compute confidence level
  last_updated?: string
}

export type TestScenario = {
  id: string
  name: string
  description: string
  inputs: Record<string, number> // KPI variable name -> value
  expected_outputs?: {
    weighted_score?: number
    risk_tier?: string
    collectability_index?: number
    recommended_purchase_value?: number
  }
}

export type ScoringResult = {
  hospital: string
  overall_score: number // 0-100
  category_scores: Record<string, number>
  kpi_scores: Array<{
    id: string
    name: string
    category: string
    score: number
    weight: number
  }>
  // Computed from scoring_system config
  risk_tier?: string
  collectability_index?: number
  recommended_purchase_value?: number
  confidence_level?: string
}
