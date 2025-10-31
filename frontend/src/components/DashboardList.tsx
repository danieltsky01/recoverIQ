import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Link } from 'react-router-dom'

export type HospitalRow = {
  id: string
  name: string
  overall_score?: number
  category_scores?: Record<string, number>
  kpi_scores?: Array<{ id: string; name: string; category: string; score: number; weight: number }>
  scoredAt?: Timestamp
}

export default function DashboardList() {
  const [rows, setRows] = useState<HospitalRow[]>([])

  useEffect(() => {
    const q = query(collection(db, 'hospitals'))
    const unsub = onSnapshot(q, (snap) => {
      const list: HospitalRow[] = []
      snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) }))
      setRows(list)
    })
    return () => unsub()
  }, [])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Dashboard</h2>
          <div className="text-sm text-slate-600">{rows.length} hospitals</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-right p-2">Overall</th>
                <th className="text-left p-2">Top Category</th>
                <th className="text-right p-2">KPIs</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => (
                <tr key={h.id} className="border-t hover:bg-slate-50">
                  <td className="p-2">{h.name}</td>
                  <td className="p-2 text-right">{h.overall_score?.toFixed?.(2) ?? '-'}</td>
                  <td className="p-2">{renderTopCategory(h.category_scores)}</td>
                  <td className="p-2 text-right">{h.kpi_scores?.length ?? 0}</td>
                  <td className="p-2">
                    <Link to={`/h/${h.id}`} className="text-blue-600 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">No hospitals yet. Add one from the Admin page.</td>
                </tr>
              )}
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
