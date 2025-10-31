// Script to seed initial KPIs into Firestore
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Map units to correct metric types based on unit groups
const unitToMetricType = {
  '% complete': 'Quality / Data Integrity',
  '%': 'Financial',
  '% denied': 'Operational Efficiency',
  '% valid': 'Quality / Data Integrity',
  'Complaints / 1k accounts': 'Legal / Compliance',
  'Boolean': 'Quality / Data Integrity',
  '% centralized': 'Operational Efficiency',
  'Score (1–5)': 'Quality / Data Integrity',
};

const kpisData = [
  {
    "name": "Data Completeness",
    "definition": "Percentage of accounts in the portfolio that have all required fields (name, date of service, amount, contact info, payer type).",
    "why_it_matters": "Incomplete data reduces traceability and increases cost of collection, making portfolios less valuable.",
    "category": "Data Quality",
    "unit": "% complete",
    "trend_direction": "Higher is better",
    "benchmark_value": 95,
    "weight": 0.10,
    "scoring_rules": [
      { "condition": ">=95", "score": 5 },
      { "condition": ">=80", "score": 3 },
      { "condition": "<80", "score": 1 }
    ]
  },
  {
    "name": "Charity Care Percentage",
    "definition": "Percentage of hospital revenue written off as charity care under nonprofit or community benefit policies.",
    "why_it_matters": "High charity percentages indicate reduced collectible debt and may reflect regulatory obligations rather than poor performance.",
    "category": "Financial Performance",
    "unit": "%",
    "trend_direction": "Lower is better",
    "benchmark_value": 3,
    "weight": 0.08,
    "scoring_rules": [
      { "condition": "<=3", "score": 5 },
      { "condition": "<=6", "score": 3 },
      { "condition": ">6", "score": 1 }
    ]
  },
  {
    "name": "Claim Denial Rate",
    "definition": "Percentage of insurance claims denied or returned for correction.",
    "why_it_matters": "High denial rates suggest billing process inefficiencies that may spill into patient receivables, increasing uncollectible balances.",
    "category": "Operational Efficiency",
    "unit": "% denied",
    "trend_direction": "Lower is better",
    "benchmark_value": 5,
    "weight": 0.08,
    "scoring_rules": [
      { "condition": "<=5", "score": 5 },
      { "condition": "<=10", "score": 3 },
      { "condition": ">10", "score": 1 }
    ]
  },
  {
    "name": "Data Transfer Quality",
    "definition": "Percentage of accounts successfully validated upon import or transfer to the buyer's system.",
    "why_it_matters": "Clean, validated data reduces onboarding time and error rates for agencies, directly improving ROI.",
    "category": "Data Quality",
    "unit": "% valid",
    "trend_direction": "Higher is better",
    "benchmark_value": 95,
    "weight": 0.07,
    "scoring_rules": [
      { "condition": ">=95", "score": 5 },
      { "condition": ">=85", "score": 3 },
      { "condition": "<85", "score": 1 }
    ]
  },
  {
    "name": "Legal Dispute Frequency",
    "definition": "Number of legal disputes or patient complaints per 1,000 accounts in the portfolio.",
    "why_it_matters": "High dispute frequency signals compliance risks and potential reputational issues for both hospitals and buyers.",
    "category": "Legal & Compliance",
    "unit": "Complaints / 1k accounts",
    "trend_direction": "Lower is better",
    "benchmark_value": 2,
    "weight": 0.08,
    "scoring_rules": [
      { "condition": "<=1", "score": 5 },
      { "condition": "<=3", "score": 3 },
      { "condition": ">3", "score": 1 }
    ]
  },
  {
    "name": "PHI Security Compliance",
    "definition": "Whether patient health information (PHI) is fully de-identified and transmitted securely per HIPAA guidelines.",
    "why_it_matters": "Ensures privacy and prevents costly breaches, a key consideration for compliant debt transfers.",
    "category": "Legal & Compliance",
    "unit": "Boolean",
    "trend_direction": "Higher is better",
    "benchmark_value": 1,
    "weight": 0.07,
    "scoring_rules": [
      { "condition": "== true", "score": 5 },
      { "condition": "== false", "score": 1 }
    ]
  },
  {
    "name": "Patient Complaint Rate",
    "definition": "Number of verified patient complaints related to billing or collections per 1,000 accounts.",
    "why_it_matters": "Measures ethical and reputational risk; lower complaint rates reflect fair and transparent collection practices.",
    "category": "Ethical / ESG",
    "unit": "Complaints / 1k accounts",
    "trend_direction": "Lower is better",
    "benchmark_value": 2,
    "weight": 0.07,
    "scoring_rules": [
      { "condition": "<=1", "score": 5 },
      { "condition": "<=3", "score": 3 },
      { "condition": ">3", "score": 1 }
    ]
  },
  {
    "name": "Billing Centralization",
    "definition": "Degree to which the hospital's billing operations are centralized under a unified system.",
    "why_it_matters": "Centralized billing ensures consistency, cleaner data, and faster dispute resolution.",
    "category": "Operational Efficiency",
    "unit": "% centralized",
    "trend_direction": "Higher is better",
    "benchmark_value": 90,
    "weight": 0.07,
    "scoring_rules": [
      { "condition": ">=90", "score": 5 },
      { "condition": ">=70", "score": 3 },
      { "condition": "<70", "score": 1 }
    ]
  },
  {
    "name": "Community Reputation Index",
    "definition": "Composite score derived from public sentiment, community engagement, and complaint ratios.",
    "why_it_matters": "Hospitals with better reputations face fewer escalations and support more ethical collection efforts.",
    "category": "Ethical / ESG",
    "unit": "Score (1–5)",
    "trend_direction": "Higher is better",
    "benchmark_value": 4,
    "weight": 0.08,
    "scoring_rules": [
      { "condition": ">=4.5", "score": 5 },
      { "condition": ">=3.5", "score": 3 },
      { "condition": "<3.5", "score": 1 }
    ]
  },
  {
    "name": "Payer Mix (Self-Pay Percentage)",
    "definition": "Percentage of accounts classified as self-pay (uninsured) versus insured or government payers.",
    "why_it_matters": "Higher self-pay ratios indicate higher risk portfolios with lower recovery rates.",
    "category": "Financial Performance",
    "unit": "%",
    "trend_direction": "Lower is better",
    "benchmark_value": 40,
    "weight": 0.10,
    "scoring_rules": [
      { "condition": "<=40", "score": 5 },
      { "condition": "<=60", "score": 3 },
      { "condition": ">60", "score": 1 }
    ]
  }
];

// Transform to full KPI objects with all required fields
const kpis = kpisData.map((kpi, index) => {
  const metric_type = unitToMetricType[kpi.unit] || 'Financial';
  
  return {
    id: `kpi_${Date.now()}_${index}`,
    name: kpi.name,
    definition: kpi.definition,
    why_it_matters: kpi.why_it_matters,
    category: kpi.category,
    metric_type: metric_type,
    data_source: 'Hospital EMR / Billing System',
    unit: kpi.unit,
    trend_direction: kpi.trend_direction,
    benchmark_range: {
      low: kpi.benchmark_value * 0.8,
      high: kpi.benchmark_value * 1.2
    },
    weight: kpi.weight,
    scoring_rules: kpi.scoring_rules,
    editable_by: 'admin',
    tags: ['initial', 'core'],
    last_updated: new Date().toISOString(),
    enabled: true
  };
});

async function seedKPIs() {
  try {
    console.log('Seeding KPIs to Firestore...');
    
    await db.collection('config').doc('kpis').set({
      kpis: kpis,
      last_updated: new Date().toISOString()
    });
    
    console.log(`✅ Successfully seeded ${kpis.length} KPIs`);
    console.log('\nKPIs created:');
    kpis.forEach((kpi, i) => {
      console.log(`  ${i + 1}. ${kpi.name} (${kpi.metric_type} - ${kpi.unit})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding KPIs:', error);
    process.exit(1);
  }
}

seedKPIs();
