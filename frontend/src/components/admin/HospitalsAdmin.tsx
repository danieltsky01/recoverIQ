import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type Hospital = {
  id?: string
  name: string
  gross_revenue: number
  total_ar: number
  avg_balance: number
  debt_age: number
  recovery_rate: number
  self_pay_percent: number
  zip_income: number
  statute_months: number
  number_of_beds: number
  // New KPI scoring outputs
  overall_score?: number
  category_scores?: Record<string, number>
  kpi_scores?: Array<{ id: string; name: string; category: string; score: number; weight: number }>
}

const initial: Hospital = {
  name: '',
  gross_revenue: 0,
  total_ar: 0,
  avg_balance: 0,
  debt_age: 0,
  recovery_rate: 0,
  self_pay_percent: 0,
  zip_income: 0,
  statute_months: 0,
  number_of_beds: 0,
}

export default function HospitalsAdmin() {
  const [list, setList] = useState<Hospital[]>([])
  const [form, setForm] = useState<Hospital>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'hospitals'))
    const unsub = onSnapshot(q, (snap) => {
      const rows: Hospital[] = []
      snap.forEach(d => rows.push({ id: d.id, ...(d.data() as any) }))
      setList(rows)
    })
    return () => unsub()
  }, [])

  function update<K extends keyof Hospital>(k: K, v: Hospital[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const ref = collection(db, 'hospitals')
      await addDoc(ref, { ...form, createdAt: serverTimestamp() })
      setForm(initial)
    } catch (e: any) {
      setError(e.message || 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id?: string) {
    if (!id) return
    await deleteDoc(doc(db, 'hospitals', id))
  }

  async function rescore(h: Hospital) {
    try {
      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
      const res = await fetch(`${base}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: h.name,
          gross_revenue: h.gross_revenue,
          total_ar: h.total_ar,
          avg_balance: h.avg_balance,
          debt_age: h.debt_age,
          recovery_rate: h.recovery_rate,
          self_pay_percent: h.self_pay_percent,
          zip_income: h.zip_income,
          statute_months: h.statute_months,
          number_of_beds: h.number_of_beds,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Score failed')
      if (h.id) {
        await updateDoc(doc(db, 'hospitals', h.id), {
          overall_score: data.overall_score,
          category_scores: data.category_scores,
          kpi_scores: data.kpi_scores,
          scoredAt: serverTimestamp(),
        })
      }
    } catch (e) {
      console.error(e)
      alert('Score failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h2 className="font-semibold">Add Hospital</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">Name
            <input className="border rounded p-2 w-full" value={form.name} onChange={e => update('name', e.target.value)} />
          </label>
          <label className="text-sm">Gross Revenue
            <input type="number" className="border rounded p-2 w-full" value={form.gross_revenue} onChange={e => update('gross_revenue', Number(e.target.value))} />
          </label>
          <label className="text-sm">Total AR
            <input type="number" className="border rounded p-2 w-full" value={form.total_ar} onChange={e => update('total_ar', Number(e.target.value))} />
          </label>
          <label className="text-sm">Avg Balance
            <input type="number" className="border rounded p-2 w-full" value={form.avg_balance} onChange={e => update('avg_balance', Number(e.target.value))} />
          </label>
          <label className="text-sm">Debt Age (days)
            <input type="number" className="border rounded p-2 w-full" value={form.debt_age} onChange={e => update('debt_age', Number(e.target.value))} />
          </label>
          <label className="text-sm">Recovery Rate (%)
            <input type="number" className="border rounded p-2 w-full" value={form.recovery_rate} onChange={e => update('recovery_rate', Number(e.target.value))} />
          </label>
          <label className="text-sm">Self-pay (%)
            <input type="number" className="border rounded p-2 w-full" value={form.self_pay_percent} onChange={e => update('self_pay_percent', Number(e.target.value))} />
          </label>
          <label className="text-sm">ZIP Income
            <input type="number" className="border rounded p-2 w-full" value={form.zip_income} onChange={e => update('zip_income', Number(e.target.value))} />
          </label>
          <label className="text-sm">Statute Months
            <input type="number" className="border rounded p-2 w-full" value={form.statute_months} onChange={e => update('statute_months', Number(e.target.value))} />
          </label>
          <label className="text-sm">Number of Beds
            <input type="number" className="border rounded p-2 w-full" value={form.number_of_beds} onChange={e => update('number_of_beds', Number(e.target.value))} />
          </label>
        </div>
        <button onClick={create} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Hospitals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-right p-2">Overall</th>
                <th className="text-left p-2">Top Category</th>
                <th className="text-right p-2">Updated</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(h => (
                <tr key={h.id} className="border-t">
                  <td className="p-2">{h.name}</td>
                  <td className="p-2 text-right">{h.overall_score?.toFixed?.(2) ?? '-'}</td>
                  <td className="p-2">{renderTopCategory(h.category_scores)}</td>
                  <td className="p-2 text-right">{(h as any).scoredAt ? '✓' : '-'}</td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => rescore(h)} className="text-blue-600 hover:underline">Score</button>
                    <button onClick={() => remove(h.id)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function renderTopCategory(map?: Record<string, number>) {
  if (!map) return '-'
  const entries = Object.entries(map)
  if (entries.length === 0) return '-'
  entries.sort((a,b)=> (b[1]||0)-(a[1]||0))
  const [name, score] = entries[0]
  return `${name} (${(score||0).toFixed(1)})`
}
