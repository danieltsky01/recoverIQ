"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreHospital = exports.health = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const expr_eval_1 = require("expr-eval");
(0, app_1.initializeApp)({ credential: (0, app_1.applicationDefault)() });
const db = (0, firestore_1.getFirestore)();
async function getKpis() {
    try {
        const snap = await db.collection('config').doc('kpis').get();
        if (!snap.exists)
            return [];
        const data = snap.data();
        const arr = Array.isArray(data?.kpis) ? data.kpis : [];
        return arr;
    }
    catch (e) {
        logger.warn('getKpis failed; returning empty', e);
        return [];
    }
}
function evaluateKpis(input, kpis) {
    const parser = new expr_eval_1.Parser();
    const helpers = {
        min: (...args) => Math.min(...args.map(Number)),
        max: (...args) => Math.max(...args.map(Number)),
        clamp: (x, a, b) => Math.min(Math.max(Number(x), Number(a)), Number(b)),
        if: (cond, a, b) => (cond ? a : b),
    };
    const enabled = kpis.filter(k => k.enabled !== false && (k.weight ?? 0) > 0);
    const kpi_scores = [];
    const catWeights = new Map();
    const catWeighted = new Map();
    for (const k of enabled) {
        let s = 0;
        try {
            const ctx = { ...input };
            const rules = Array.isArray(k.scoring_rules) ? k.scoring_rules : [];
            let matched = false;
            // Auto-detect score range from rules
            const allScores = rules.map(r => Number(r.score || 0));
            const minRuleScore = allScores.length > 0 ? Math.min(...allScores) : 0;
            const maxRuleScore = allScores.length > 0 ? Math.max(...allScores) : 1;
            for (const r of rules) {
                const cond = parser.parse(r.condition || 'false');
                const ok = !!cond.evaluate({ ...ctx, ...helpers });
                if (ok) {
                    const rawScore = Number(r.score || 0);
                    // Normalize to 0-1 range based on detected min/max
                    const range = maxRuleScore - minRuleScore;
                    s = range > 0 ? (rawScore - minRuleScore) / range : 0;
                    s = Math.max(0, Math.min(1, s));
                    matched = true;
                    break;
                }
            }
            if (!matched)
                s = 0;
        }
        catch (e) {
            logger.error('KPI rule eval error', { kpi: k.name, error: e?.message });
            s = 0;
        }
        kpi_scores.push({ id: k.id, name: k.name, category: k.category, score: s, weight: Number(k.weight || 0) });
        catWeights.set(k.category, (catWeights.get(k.category) || 0) + Number(k.weight || 0));
        catWeighted.set(k.category, (catWeighted.get(k.category) || 0) + s * Number(k.weight || 0));
    }
    const totalWeight = kpi_scores.reduce((sum, k) => sum + k.weight, 0) || 1;
    const overall = (kpi_scores.reduce((sum, k) => sum + k.score * k.weight, 0) / totalWeight) * 100;
    const category_scores = {};
    for (const [cat, w] of catWeights.entries()) {
        const num = catWeighted.get(cat) || 0;
        category_scores[cat] = w > 0 ? (num / w) * 100 : 0;
    }
    return {
        overall_score: Math.round(overall * 100) / 100,
        category_scores,
        kpi_scores,
    };
}
exports.health = (0, https_1.onRequest)({ cors: true }, async (_req, res) => {
    res.status(200).json({ status: "ok" });
});
exports.scoreHospital = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
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
        const input = (req.body || {});
        const name = String(input.name || 'Unknown');
        const kpis = await getKpis();
        const result = evaluateKpis(input, kpis);
        const out = { hospital: name, ...result };
        res.status(200).json(out);
    }
    catch (e) {
        logger.error("scoreHospital failed", e);
        res.status(500).json({ error: e?.message || "Internal error" });
    }
});
