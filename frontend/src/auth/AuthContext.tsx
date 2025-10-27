import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut: () => signOut(auth) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
