import { useMutation } from '@tanstack/react-query'
import { MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendChat, type ChatMsg } from '../../lib/rxApi'

export function ChatWidget({ drugs }: { drugs: string[] }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const m = useMutation({
    mutationFn: (next: ChatMsg[]) => sendChat(next, drugs),
    onSuccess: reply => { if (reply) setMsgs(x => [...x, { role: 'assistant', content: reply }]) },
    onError: e => setError(e instanceof Error ? e.message : 'Could not reach the assistant.'),
  })
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, open, m.isPending])

  function send(e: FormEvent) {
    e.preventDefault()
    const t = draft.trim()
    if (!t || m.isPending) return
    const next: ChatMsg[] = [...msgs, { role: 'user', content: t }]
    setMsgs(next); setDraft(''); setError(''); m.mutate(next)
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div role="dialog" aria-label="GeneMeds assistant" className="flex h-[460px] max-h-[70vh] w-[340px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-card border border-line bg-white shadow-pop">
          <div className="bg-gradient-to-r from-navy to-violet p-4 text-white">
            <strong className="font-heading text-sm">GeneMeds Assistant</strong>
            <p className="text-xs opacity-85">Workflow help and general pharmacogenomics. No patient details are shared.</p>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-canvas p-4">
            {msgs.length === 0 && <p className="rounded-card bg-lav-light p-3 text-sm text-muted">Ask about entering diplotypes, reading a recommendation, or a gene-drug pair.</p>}
            {msgs.map((x, i) => (
              <p key={i} className={`max-w-[85%] whitespace-pre-wrap break-words rounded-card px-3 py-2 text-sm ${x.role === 'user' ? 'self-end rounded-br-sm bg-violet text-white' : 'self-start rounded-bl-sm bg-white text-ink shadow-card'}`}>{x.content}</p>
            ))}
            {m.isPending && <p role="status" className="self-start rounded-card bg-white px-3 py-2 text-sm text-muted shadow-card">Thinking…</p>}
            <div ref={end} />
          </div>
          {error && <p role="alert" className="mx-4 mb-2 rounded-ctl border border-err/30 bg-err/10 px-3 py-2 text-xs text-err">{error}</p>}
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <input aria-label="Message" value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000} placeholder="Type a message…" autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-ctl border border-line px-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
            <button type="submit" aria-label="Send" disabled={!draft.trim() || m.isPending} className="grid size-10 place-items-center rounded-ctl bg-violet text-white disabled:opacity-50"><Send className="size-4" /></button>
          </form>
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={open ? 'Close assistant' : 'Open assistant'}
        className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-violet to-navy text-white shadow-pop transition hover:scale-105">
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  )
}