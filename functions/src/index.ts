import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import * as logger from "firebase-functions/logger";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Parser } from "expr-eval";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// New KPI-driven scoring
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

type BenchmarkRange = { low: number; high: number }
type KpiRule = { condition: string; score: number } // score can be any number (auto-normalized)
type KPI = {
  id: string
  name: string
  definition: string
  why_it_matters: string
  metric_type: MetricType
  data_source: string
  weight: number // relative weight (not necessarily normalized)
  scoring_rules: KpiRule[]
  unit: string
  category: KpiCategory
  trend_direction: 'Higher is better' | 'Lower is better'
  benchmark_range?: BenchmarkRange
  last_updated?: string
  editable_by?: string
  tags?: string[]
  enabled?: boolean
}

async function getKpis(): Promise<KPI[]> {
  try {
    const snap = await db.collection('config').doc('kpis').get();
    if (!snap.exists) return [];
    const data = snap.data() as any;
    const arr = Array.isArray(data?.kpis) ? data.kpis as KPI[] : [];
    return arr;
  } catch (e) {
    logger.warn('getKpis failed; returning empty', e);
    return [];
  }
}
type ScoreResult = {
  hospital: string
  overall_score: number // 0..100
  category_scores: Record<KpiCategory, number> // 0..100 per category
  kpi_scores: Array<{ id: string; name: string; category: KpiCategory; score: number; weight: number }>
}

function evaluateKpis(input: Record<string, any>, kpis: KPI[]): Omit<ScoreResult, 'hospital'> {
  const parser = new Parser()
  const helpers: Record<string, any> = {
    min: (...args: any[]) => Math.min(...args.map(Number)),
    max: (...args: any[]) => Math.max(...args.map(Number)),
    clamp: (x: any, a: any, b: any) => Math.min(Math.max(Number(x), Number(a)), Number(b)),
    if: (cond: any, a: any, b: any) => (cond ? a : b),
  }

  const enabled = kpis.filter(k => k.enabled !== false && (k.weight ?? 0) > 0)
  const kpi_scores = [] as Array<{ id: string; name: string; category: KpiCategory; score: number; weight: number }>
  const catWeights = new Map<KpiCategory, number>()
  const catWeighted = new Map<KpiCategory, number>()

  for (const k of enabled) {
    let s = 0
    try {
      const ctx = { ...input }
      const rules = Array.isArray(k.scoring_rules) ? k.scoring_rules : []
      let matched = false
      
      // Auto-detect score range from rules
      const allScores = rules.map(r => Number(r.score || 0))
      const minRuleScore = allScores.length > 0 ? Math.min(...allScores) : 0
      const maxRuleScore = allScores.length > 0 ? Math.max(...allScores) : 1
      
      for (const r of rules) {
        const cond = parser.parse(r.condition || 'false')
        const ok = !!cond.evaluate({ ...ctx, ...helpers })
        if (ok) {
          const rawScore = Number(r.score || 0)
          // Normalize to 0-1 range based on detected min/max
          const range = maxRuleScore - minRuleScore
          s = range > 0 ? (rawScore - minRuleScore) / range : 0
          s = Math.max(0, Math.min(1, s))
          matched = true
          break
        }
      }
      if (!matched) s = 0
    } catch (e) {
      logger.error('KPI rule eval error', { kpi: k.name, error: (e as any)?.message })
      s = 0
    }
    kpi_scores.push({ id: k.id, name: k.name, category: k.category, score: s, weight: Number(k.weight || 0) })
    catWeights.set(k.category, (catWeights.get(k.category) || 0) + Number(k.weight || 0))
    catWeighted.set(k.category, (catWeighted.get(k.category) || 0) + s * Number(k.weight || 0))
  }

  const totalWeight = kpi_scores.reduce((sum, k) => sum + k.weight, 0) || 1
  const overall = (kpi_scores.reduce((sum, k) => sum + k.score * k.weight, 0) / totalWeight) * 100
  const category_scores = {} as Record<KpiCategory, number>
  for (const [cat, w] of catWeights.entries()) {
    const num = catWeighted.get(cat) || 0
    category_scores[cat] = w > 0 ? (num / w) * 100 : 0
  }

  return {
    overall_score: Math.round(overall * 100) / 100,
    category_scores,
    kpi_scores,
  }
}

export const health = onRequest({ cors: true }, async (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export const scoreHospital = onRequest({ cors: true }, async (req: Request, res: Response) => {
  // Set CORS headers explicitly
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  try {
    const input = (req.body || {}) as Record<string, any>
    const name = String(input.name || 'Unknown')
    const kpis = await getKpis()
    const result = evaluateKpis(input, kpis)
    const out: ScoreResult = { hospital: name, ...result }
    res.status(200).json(out)
  } catch (e: any) {
    logger.error("scoreHospital failed", e);
    res.status(500).json({ error: e?.message || "Internal error" });
  }
});
