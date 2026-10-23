import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fmt, listAudit } from '../../lib/adminApi'
import { ErrorBox, Pager } from './ui'

const ACTIONS = ['user.approve', 'user.reject', 'user.suspend', 'user.reactivate', 'user.reopen']

export function AuditTab() {
  const [action, setAction] = useState('')
  const [offset, setOffset] = useState(0)
  const q = useQuery({
    queryKey: ['admin', 'audit', action, offset],
    queryFn: () => listAudit({ action: action || undefined, offset }),
    placeholderData: keepPreviousData,
  })

  return (
    <section>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet">Clinical administration</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Audit log</h1>
        <p className="mt-1 text-muted">Every approval, rejection and suspension, with who did it and why.</p>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm font-semibold">
        Action
        <select value={action} onChange={e => { setAction(e.target.value); setOffset(0) }}
          className="h-10 rounded-ctl border border-line bg-white px-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15">
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>

      {q.isError && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.isPending && <p role="status" className="py-10 text-center text-muted">Loading audit log…</p>}
      {q.data && q.data.items.length === 0 && (
        <p className="rounded-card border border-dashed border-line bg-white py-10 text-center text-muted">No audit entries yet.</p>
      )}
      {q.data && q.data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-lav-pale text-xs uppercase tracking-wide text-muted">
                <tr><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Change</th><th className="p-3">Reason</th></tr>
              </thead>
              <tbody>
                {q.data.items.map(e => {
                  const d = e.details as { from?: string; to?: string } | null
                  return (
                    <tr key={e.id} className="border-t border-line align-top">
                      <td className="whitespace-nowrap p-3">{fmt(e.occurredAt)}</td>
                      <td className="p-3">{e.actorUserId ?? '—'}</td>
                      <td className="p-3 font-semibold">{e.action}</td>
                      <td className="p-3">{e.targetType} {e.targetId}</td>
                      <td className="p-3">{d?.from && d?.to ? `${d.from} → ${d.to}` : '—'}</td>
                      <td className="p-3">{e.reason || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager total={q.data.total} offset={offset} onChange={setOffset} />
        </>
      )}
    </section>
  )
}