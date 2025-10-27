import { useState, type FormEvent, type ChangeEvent } from 'react'
import type { ScoreResponse } from '@/App'

type Props = {
	onScored: (result: ScoreResponse) => void
}

type FormState = {
	name: string
	gross_revenue: number | ''
	total_ar: number | ''
	avg_balance: number | ''
	debt_age: number | ''
	recovery_rate: number | ''
	self_pay_percent: number | ''
	zip_income: number | ''
	statute_months: number | ''
}

const initialState: FormState = {
	name: '',
	gross_revenue: '',
	total_ar: '',
	avg_balance: '',
	debt_age: '',
	recovery_rate: '',
	self_pay_percent: '',
	zip_income: '',
	statute_months: '',
}

export default function ScoreForm({ onScored }: Props) {
	const [form, setForm] = useState<FormState>(initialState)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

		function update<K extends keyof FormState>(key: K, value: FormState[K]) {
			setForm((f: FormState) => ({ ...f, [key]: value }))
	}

		async function submit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		setLoading(true)
		try {
			// Basic front-end validation
			if (!form.name) throw new Error('Name is required')

			const payload = {
				name: form.name,
				gross_revenue: Number(form.gross_revenue || 0),
				total_ar: Number(form.total_ar || 0),
				avg_balance: Number(form.avg_balance || 0),
				debt_age: Number(form.debt_age || 0),
				recovery_rate: Number(form.recovery_rate || 0),
				self_pay_percent: Number(form.self_pay_percent || 0),
				zip_income: Number(form.zip_income || 0),
				statute_months: Number(form.statute_months || 0),
			}

					// Use VITE_API_BASE_URL when provided (local dev), otherwise default to '/api' so
					// Firebase Hosting can rewrite to Cloud Run in production without CORS headaches.
					const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
					const res = await fetch(`${base}/score`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!res.ok) {
				const txt = await res.text()
				throw new Error(txt || 'Request failed')
			}
			const data = (await res.json()) as ScoreResponse
			onScored(data)
		} catch (err: any) {
			setError(err.message || 'Something went wrong')
		} finally {
			setLoading(false)
		}
	}

	return (
		<form onSubmit={submit} className="bg-white rounded-lg shadow p-4 space-y-3">
			<h2 className="font-semibold text-lg">Enter Hospital Data</h2>
			{error && <p className="text-red-600 text-sm">{error}</p>}

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<label className="flex flex-col text-sm">
					Name
								<input className="border rounded p-2" value={form.name}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('name', e.target.value)} placeholder="Acme Health" />
				</label>
				<label className="flex flex-col text-sm">
					Gross Revenue ($)
								<input type="number" className="border rounded p-2" value={form.gross_revenue}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('gross_revenue', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					Total AR ($)
								<input type="number" className="border rounded p-2" value={form.total_ar}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('total_ar', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					Avg Balance ($)
								<input type="number" className="border rounded p-2" value={form.avg_balance}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('avg_balance', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					Debt Age (days)
								<input type="number" className="border rounded p-2" value={form.debt_age}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('debt_age', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					Recovery Rate (%)
								<input type="number" min={0} max={100} className="border rounded p-2" value={form.recovery_rate}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('recovery_rate', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					Self-pay (%)
								<input type="number" min={0} max={100} className="border rounded p-2" value={form.self_pay_percent}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('self_pay_percent', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					ZIP Income ($)
								<input type="number" className="border rounded p-2" value={form.zip_income}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('zip_income', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
				<label className="flex flex-col text-sm">
					Statute Months
								<input type="number" className="border rounded p-2" value={form.statute_months}
									onChange={(e: ChangeEvent<HTMLInputElement>) => update('statute_months', e.target.value === '' ? '' : Number(e.target.value))} />
				</label>
			</div>

			<button disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
				{loading ? 'Scoring…' : 'Score Hospital'}
			</button>
		</form>
	)
}
