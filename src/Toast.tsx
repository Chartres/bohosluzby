import { useEffect, useState } from 'react'

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const show = (m: string, durationMs = 2500) => {
    setMsg(m)
    setTimeout(() => setMsg(null), durationMs)
  }
  return { msg, show }
}

export function Toast({ msg }: { msg: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (msg) setVisible(true)
    else setTimeout(() => setVisible(false), 300)
  }, [msg])

  if (!msg) return null

  return (
    <div
      className={`fixed bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-ink text-parchment px-4 py-2 text-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      {msg}
    </div>
  )
}
