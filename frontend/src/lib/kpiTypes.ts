export type MetricType = 
  | 'Financial'
  | 'Time'
  | 'Volume / Count'
  | 'Quality / Data Integrity'
  | 'Legal / Compliance'
  | 'Operational Efficiency'
  | 'Socioeconomic / ESG'
  | 'Textual / Categorical'

export type KpiCategory =
  | 'Financial Performance'
  | 'Portfolio Composition'
  | 'Operational Efficiency'
  | 'Legal & Compliance'
  | 'Data Quality'
  | 'Ethical / ESG'

export type TrendDirection = 'Higher is better' | 'Lower is better'

export type KpiRule = {
  // JavaScript-like boolean expression evaluated with expr-eval against input context
  // Example: "recovery_rate >= 10"
  condition: string
  // Score: Can be any number you want (1-5, 0-100, or any scale)
  // System automatically normalizes based on min/max scores across all rules
  score: number
  // Optional human-readable description of what this rule means
  description?: string
}

export type BenchmarkRange = {
  low: number
  high: number
}

// 🧩 RecoverIQ KPI Unit Library
export type KpiUnitGroup = {
  group: string
  units: Array<{ value: string; label: string; example?: string }>
}

export const KPI_UNIT_GROUPS: KpiUnitGroup[] = [
  {
    group: 'Financial',
    units: [
      { value: '%', label: 'Percentage', example: 'Recovery Rate = 8%' },
      { value: '$', label: 'U.S. Dollars', example: 'Avg. Balance = $2,500' },
      { value: '$M', label: 'Millions of Dollars', example: 'Gross Revenue = $750M' },
      { value: '$ / acct', label: 'Dollars per Account', example: 'Avg. Account Balance = $3,200' },
      { value: '$ / patient', label: 'Dollars per Patient', example: 'Cost per Patient = $1,200' },
      { value: 'Ratio', label: 'Ratio', example: 'Debt-to-Revenue = 0.12' },
      { value: 'Index', label: 'Index Value', example: 'Recovery Index = 1.15' },
    ],
  },
  {
    group: 'Time',
    units: [
      { value: 'Days', label: 'Days', example: 'Avg. Debt Age = 210 days' },
      { value: 'Months', label: 'Months', example: 'Statute Remaining = 18 months' },
      { value: 'Years', label: 'Years', example: 'Staff Tenure = 4 years' },
      { value: 'Days / claim', label: 'Days per Claim', example: 'Days in A/R = 42' },
    ],
  },
  {
    group: 'Volume / Count',
    units: [
      { value: 'Count', label: 'Count', example: 'Facilities = 8' },
      { value: '# of accounts', label: 'Accounts', example: '25,000 accounts' },
      { value: '# of facilities', label: 'Facilities', example: '12 facilities' },
      { value: '# of patients', label: 'Patients', example: '2,400 patients' },
      { value: '# / month', label: 'Count per Month', example: '300 claims/month' },
      { value: '# / year', label: 'Count per Year', example: '5,000 new accounts/year' },
    ],
  },
  {
    group: 'Quality / Data Integrity',
    units: [
      { value: '% complete', label: '% Complete', example: 'Data Completeness = 95%' },
      { value: '% valid', label: '% Valid', example: 'Verified Contact Info = 88%' },
      { value: '% error', label: '% Error', example: 'Import Error Rate = 2%' },
      { value: 'Score (1–5)', label: 'Score (1-5)', example: 'Risk Level = 4' },
      { value: 'Boolean', label: 'Yes / No', example: 'HIPAA Certified = Yes' },
      { value: 'Flag', label: 'Flag (True/False)', example: 'Data Encrypted = True' },
    ],
  },
  {
    group: 'Legal / Compliance',
    units: [
      { value: 'Months Remaining', label: 'Months Remaining', example: 'Statute of Limitations = 24' },
      { value: 'Violations / year', label: 'Violations per Year', example: '2' },
      { value: 'Complaints / 1k accounts', label: 'Complaints per 1k', example: '1.5' },
    ],
  },
  {
    group: 'Operational Efficiency',
    units: [
      { value: '% denied', label: '% Denied', example: 'Claim Denial Rate = 7%' },
      { value: '% automated', label: '% Automated', example: 'Electronic Claims = 85%' },
      { value: 'Hours', label: 'Hours', example: 'Avg. Response Time = 36 hrs' },
      { value: 'Days / billing cycle', label: 'Days per Cycle', example: '30 days' },
      { value: '% centralized', label: '% Centralized', example: 'Billing Centralized = 100%' },
    ],
  },
  {
    group: 'Socioeconomic / ESG',
    units: [
      { value: '$', label: 'Median Income ($)', example: '62,500' },
      { value: 'Complaints / year', label: 'Complaints per Year', example: '3' },
      { value: 'Satisfaction Score (1–5)', label: 'Satisfaction Score (1-5)', example: '4.3' },
      { value: '% trained', label: '% Trained', example: 'Compliance Training = 92%' },
    ],
  },
  {
    group: 'Textual / Categorical',
    units: [
      { value: 'Text', label: 'Textual Description', example: 'EMR System = Epic' },
      { value: 'Enum', label: 'Enumerated Type', example: 'Billing System: Centralized/Decentralized' },
      { value: 'Category', label: 'Category Label', example: 'Portfolio Type = "Charity"' },
    ],
  },
]

// Flatten all units for validation
export const ALL_UNITS = KPI_UNIT_GROUPS.flatMap(g => g.units.map(u => u.value))

export type KPI = {
  id: string // unique key
  name: string
  definition: string
  why_it_matters: string
  category: KpiCategory
  metric_type: MetricType
  data_source: string
  unit: string // Selected from KPI_UNIT_GROUPS
  trend_direction: TrendDirection
  benchmark_range?: BenchmarkRange // Optional low/high benchmark values
  weight: number // 0..1 (relative weight inside overall aggregation)
  scoring_rules: KpiRule[]
  editable_by?: string // role
  tags?: string[]
  last_updated?: string // ISO date
  enabled?: boolean
}

export const KPI_CATEGORIES: KpiCategory[] = [
  'Financial Performance',
  'Portfolio Composition',
  'Operational Efficiency',
  'Legal & Compliance',
  'Data Quality',
  'Ethical / ESG',
]

export const METRIC_TYPES: MetricType[] = [
  'Financial',
  'Time',
  'Volume / Count',
  'Quality / Data Integrity',
  'Legal / Compliance',
  'Operational Efficiency',
  'Socioeconomic / ESG',
  'Textual / Categorical'
]

// Map Metric Types to their corresponding unit groups
export const METRIC_TYPE_TO_UNITS: Record<MetricType, string[]> = {
  'Financial': KPI_UNIT_GROUPS[0].units.map(u => u.value),
  'Time': KPI_UNIT_GROUPS[1].units.map(u => u.value),
  'Volume / Count': KPI_UNIT_GROUPS[2].units.map(u => u.value),
  'Quality / Data Integrity': KPI_UNIT_GROUPS[3].units.map(u => u.value),
  'Legal / Compliance': KPI_UNIT_GROUPS[4].units.map(u => u.value),
  'Operational Efficiency': KPI_UNIT_GROUPS[5].units.map(u => u.value),
  'Socioeconomic / ESG': KPI_UNIT_GROUPS[6].units.map(u => u.value),
  'Textual / Categorical': KPI_UNIT_GROUPS[7].units.map(u => u.value),
}

