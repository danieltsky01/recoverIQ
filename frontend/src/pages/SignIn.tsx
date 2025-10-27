import { useState, type FormEvent } from 'react'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form className="bg-white p-6 rounded-lg shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in to recoverIQ</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <label className="text-sm flex flex-col">
          Email
          <input
            type="email"
            className="border rounded p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="text-sm flex flex-col">
          Password
          <input
            type="password"
            className="border rounded p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button onClick={handleSignIn} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 w-full">
          {loading ? 'Working…' : 'Sign In'}
        </button>
        <p className="text-xs text-slate-500">Contact your administraotr for sign in information.</p>
      </form>
    </div>
  )
}
