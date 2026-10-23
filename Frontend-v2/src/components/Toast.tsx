import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
type Item = { id: number; kind: Kind; text: string }
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

const COLOR: Record<Kind, string> = { success: 'border-ok text-ok', error: 'border-err text-err', info: 'border-info text-navy' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems(list => [...list, { id, kind, text }])
    setTimeout(() => setItems(list => list.filter(i => i.id !== id)), 4000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map(i => (
          <div key={i.id} className={`rounded-ctl border-l-4 bg-white px-4 py-3 text-sm font-medium shadow-pop ${COLOR[i.kind]}`}>{i.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}