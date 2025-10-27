import type { ScoreResponse } from '@/App'

type Props = {
	result: ScoreResponse | null
}

export default function Dashboard({ result }: Props) {
	if (!result) {
		return (
			<div className="bg-white rounded-lg shadow p-4">
				<h2 className="font-semibold text-lg mb-2">Results</h2>
				<p className="text-sm text-slate-600">Submit the form to see the score.</p>
			</div>
		)
	}

	return (
		<div className="bg-white rounded-lg shadow p-4 space-y-4">
			<h2 className="font-semibold text-lg">Results</h2>
			<div className="space-y-2">
				<div className="flex justify-between">
					<span>Hospital</span>
					<span className="font-medium">{result.hospital}</span>
				</div>
				<div className="flex justify-between">
					<span>Weighted Score</span>
					<span className="font-medium">{result.weighted_score.toFixed(2)} / 5.00</span>
				</div>
				<div className="flex justify-between">
					<span>Risk Level</span>
					<span className="font-medium">{result.risk_level}</span>
				</div>
				<div className="flex justify-between">
					<span>Recommended Price</span>
					<span className="font-medium">${result.recommended_purchase_value.toFixed(2)} per $1 face value</span>
				</div>
			</div>
		</div>
	)
}
