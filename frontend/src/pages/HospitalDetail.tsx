import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function HospitalDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const ref = doc(db, 'hospitals', id)
        const snap = await getDoc(ref)
        if (snap.exists()) setData({ id: snap.id, ...snap.data() })
        else setData(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) return <div className="p-6">Loading…</div>
  if (!data) return <div className="p-6">Not found.</div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-lg">{data.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
          <KV k="Overall Score" v={fmtScore(data.overall_score)} />
          <KV k="KPIs" v={data.kpi_scores?.length ?? 0} />
          <KV k="Debt Age (days)" v={data.debt_age} />
          <KV k="Avg Balance" v={fmtMoney(data.avg_balance)} />
          <KV k="Total AR" v={fmtMoney(data.total_ar)} />
          <KV k="Gross Revenue" v={fmtMoney(data.gross_revenue)} />
          <KV k="Recovery Rate (%)" v={data.recovery_rate} />
          <KV k="Self-pay (%)" v={data.self_pay_percent} />
          <KV k="ZIP Income" v={fmtMoney(data.zip_income)} />
          <KV k="Statute Months" v={data.statute_months} />
        </div>
      </div>

      {data.category_scores && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Category scores</h3>
          <div className="space-y-1 text-sm">
            {Object.entries(data.category_scores).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-64">{k}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, Number(v||0)))}%` }} />
                </div>
                <div className="w-14 text-right">{(Number(v||0)).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KV({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded p-2">
      <span className="text-slate-600">{k}</span>
      <span className="font-medium">{v ?? '-'}</span>
    </div>
  )
}

function fmtScore(n?: number) {
  if (n == null) return '-'
  return Number(n).toFixed(2)
}

function fmtMoney(n?: number) {
  if (n == null) return '-'
  return n.toLocaleString()
}
