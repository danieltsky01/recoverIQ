import { useState } from 'react'
import ScoreForm from './components/ScoreForm'
import Dashboard from './components/Dashboard'
import { useAuth } from './auth/AuthContext'
import SignIn from './pages/SignIn'

export type ScoreResponse = {
	hospital: string
	weighted_score: number
	risk_level: 'Low Risk' | 'Medium Risk' | 'High Risk'
	recommended_purchase_value: number
}

function App() {
	const { user, loading, signOut } = useAuth()
	const [result, setResult] = useState<ScoreResponse | null>(null)

	if (loading) {
		return <div className="min-h-screen flex items-center justify-center">Loading…</div>
	}

	if (!user) {
		return <SignIn />
	}

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<header className="bg-white border-b">
				<div className="mx-auto max-w-5xl p-4 flex items-center justify-between">
					<h1 className="text-xl font-semibold">Hospital Debt Scoring</h1>
					<div className="flex items-center gap-3 text-sm">
						<span className="text-slate-700">{user.email}</span>
						<button onClick={() => signOut()} className="bg-slate-200 px-3 py-1 rounded">Sign out</button>
					</div>
				</div>
			</header>
			<div className="mx-auto max-w-5xl p-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<ScoreForm onScored={setResult} />
					<Dashboard result={result} />
				</div>
			</div>
		</div>
	)
}

export default App
