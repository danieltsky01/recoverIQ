import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

export type ToastMessage = {
  id: string
  type: ToastType
  message: string
  duration?: number
}

let addToastCallback: ((toast: Omit<ToastMessage, 'id'>) => void) | null = null

export function toast(message: string, type: ToastType = 'info', duration = 3000) {
  if (addToastCallback) {
    addToastCallback({ message, type, duration })
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    addToastCallback = (t) => {
      const id = Math.random().toString(36).slice(2)
      const newToast = { ...t, id }
      setToasts(prev => [...prev, newToast])
      if (t.duration) {
        setTimeout(() => removeToast(id), t.duration)
      }
    }
    return () => { addToastCallback = null }
  }, [])

  function removeToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />,
  }

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${styles[t.type]} animate-slide-in-right`}
        >
          {icons[t.type]}
          <span className="flex-1 text-sm font-medium">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
