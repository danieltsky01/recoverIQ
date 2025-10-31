import { useState } from 'react'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import HospitalsAdmin from '@/components/admin/HospitalsAdmin'
import KPIAdmin from '@/components/admin/KPIAdmin'
import ScoringCalculator from '@/components/admin/ScoringCalculator'

export default function Admin() {
  const { isAdmin, checking } = useIsAdmin()
  const [tab, setTab] = useState<'hospitals' | 'kpis' | 'scoring'>('hospitals')
  if (checking) return <div className="p-6">Checking admin…</div>
  if (!isAdmin) return <div className="p-6 text-red-600">You must be an admin to view this page.</div>

  return (
    <div className="space-y-6 p-4">
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            className={`px-3 py-2 -mb-px border-b-2 ${tab === 'hospitals' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
            onClick={() => setTab('hospitals')}
          >Hospitals</button>
          <button
            className={`px-3 py-2 -mb-px border-b-2 ${tab === 'kpis' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
            onClick={() => setTab('kpis')}
          >KPIs</button>
          <button
            className={`px-3 py-2 -mb-px border-b-2 ${tab === 'scoring' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
            onClick={() => setTab('scoring')}
          >Scoring Calculator</button>
        </nav>
      </div>

      {tab === 'hospitals' && <HospitalsAdmin />}
      {tab === 'kpis' && <KPIAdmin />}
      {tab === 'scoring' && <ScoringCalculator />}
    </div>
  )
}
