import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setChecking(true)
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setIsAdmin(false)
        setChecking(false)
        return
      }
      try {
        const ref = doc(db, 'admins', u.uid)
        const snap = await getDoc(ref)
        setIsAdmin(snap.exists())
      } catch {
        setIsAdmin(false)
      } finally {
        setChecking(false)
      }
    })
    return () => unsub()
  }, [])

  return { isAdmin, checking }
}
