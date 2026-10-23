import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className={`m-auto max-h-[90vh] overflow-y-auto rounded-card border border-line p-7 shadow-pop backdrop:bg-navy/50 ${wide ? 'w-[min(92vw,560px)]' : 'w-[min(92vw,400px)]'}`}
    >
      <h2 id="modal-title" className="mb-2 text-xl font-bold">{title}</h2>
      {children}
    </dialog>
  )
}