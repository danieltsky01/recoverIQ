import { BrowserRouter, Link, Route, Routes, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import SignIn from './pages/SignIn'
import Admin from './pages/Admin'
import { useIsAdmin } from './hooks/useIsAdmin'
import DashboardList from './components/DashboardList'
import HospitalDetail from './pages/HospitalDetail'
import { useState } from 'react'
import { ToastContainer } from './components/ui/Toast'

export type ScoreResponse = {
  hospital: string
  overall_score: number
  category_scores: Record<string, number>
  kpi_scores: Array<{ id: string; name: string; category: string; score: number; weight: number }>
}

function App() {
	const { user, loading, signOut } = useAuth()
  const { isAdmin } = useIsAdmin()
	const [copied, setCopied] = useState(false)
	const [showAdmin, setShowAdmin] = useState(false)

	if (loading) {
		return <div className="min-h-screen flex items-center justify-center">Loading…</div>
	}

	if (!user) {
		return <SignIn />
	}

	return (
		<BrowserRouter>
						<div className="min-h-screen bg-slate-50 text-slate-900">
				<ToastContainer />
				<header className="bg-white border-b">
					<div className="mx-auto max-w-5xl p-4 flex items-center justify-between">
						<div className="flex items-center gap-6">
							<h1 className="text-xl font-semibold"><Link to="/">Hospital Debt Scoring</Link></h1>
														<nav className="text-sm text-slate-700 flex items-center gap-3">
																<Link to="/" onClick={() => setShowAdmin(false)}>Dashboard</Link>
																{isAdmin && (
																	<button
																		type="button"
																		onClick={() => setShowAdmin(v => !v)}
																		className="underline text-blue-700"
																	>{showAdmin ? 'Close Admin' : 'Admin'}</button>
																)}
														</nav>
						</div>
												<div className="flex items-center gap-2 text-sm">
														<span className="text-slate-700">{user.email}</span>
														<button
															onClick={async () => {
																try {
																	await navigator.clipboard.writeText(user.uid)
																	setCopied(true)
																	setTimeout(() => setCopied(false), 1500)
																} catch {}
															}}
															title="Copy your UID to add under Firestore admins/{uid}"
															className="border px-2 py-1 rounded text-slate-600 hover:bg-slate-50"
														>Copy UID</button>
														{copied && <span className="text-green-600">Copied</span>}
														<button onClick={() => signOut()} className="bg-slate-200 px-3 py-1 rounded">Sign out</button>
						</div>
					</div>
				</header>
								<div className="mx-auto max-w-5xl p-6">
										{showAdmin ? (
											<Admin />
										) : (
											<Routes>
												<Route path="/" element={<DashboardList />} />
												<Route path="/h/:id" element={<HospitalDetail />} />
												<Route path="*" element={<Navigate to="/" replace />} />
											</Routes>
										)}
								</div>
			</div>
		</BrowserRouter>
	)
}

export default App
