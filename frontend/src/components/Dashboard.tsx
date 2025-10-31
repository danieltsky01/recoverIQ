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
					<span>Overall Score</span>
					<span className="font-medium">{result.overall_score.toFixed(2)} / 100</span>
				</div>
				<div>
					<div className="text-sm text-slate-600 mb-1">Top categories</div>
					{renderTopCategories(result.category_scores).map(([k,v]) => (
						<div key={k} className="flex items-center gap-2 text-sm">
							<div className="w-48">{k}</div>
							<div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
								<div className="h-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
							</div>
							<div className="w-14 text-right">{v.toFixed(1)}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

function renderTopCategories(map: Record<string, number> | undefined): Array<[string, number]> {
  if (!map) return []
  const entries = Object.entries(map)
  entries.sort((a,b)=> (b[1]||0)-(a[1]||0))
  return entries.slice(0, 3)
}
