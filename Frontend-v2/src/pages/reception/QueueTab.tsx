import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { cancelVisit, listVisits, timeOf, type Visit, type VisitStatus } from '../../lib/receptionApi'
import { ErrorBox, Pager } from '../admin/ui'

const TABS: { key: VisitStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'waiting', label: 'Waiting' }, { key: 'in_consultation', label: 'In consultation' },
  { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' },
]
const BADGE: Record<VisitStatus, string> = {
  waiting: 'bg-amber-100 text-amber-800', in_consultation: 'bg-sky-100 text-sky-800',
  completed: 'bg-green-100 text-green-800', cancelled: 'bg-slate-200 text-slate-700',
}

export function QueueTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState<VisitStatus | 'all'>('all')
  const [offset, setOffset] = useState(0)
  const [target, setTarget] = useState<Visit | null>(null)
  const [error, setError] = useState('')

  const q = useQuery({
    queryKey: ['reception', 'visits', status, offset],
    queryFn: () => listVisits({ status: status === 'all' ? undefined : status, offset }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })

  const cancel = useMutation({
    mutationFn: (id: number) => cancelVisit(id),
    onSuccess: () => { toast('Visit cancelled.', 'success'); setTarget(null); void qc.invalidateQueries({ queryKey: ['reception'] }) },
    onError: e => { setError(e instanceof Error ? e.message : 'Could not cancel.'); void qc.invalidateQueries({ queryKey: ['reception'] }) },
  })

  return (
    <section>
      <div role="tablist" className="mb-4 flex w-fit flex-wrap gap-1 rounded-card border border-line bg-lav-pale p-1">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => { setStatus(t.key); setOffset(0) }}
            className={`h-9 rounded-ctl px-3.5 text-sm font-semibold transition ${status === t.key ? 'bg-white text-teal-btn shadow-card' : 'text-muted hover:text-ink'}`}>{t.label}</button>
        ))}
      </div>

      {q.isError && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.isPending && <p role="status" className="py-10 text-center text-muted">Loading today’s visits…</p>}
      {q.data && q.data.items.length === 0 && (
        <p className="rounded-card border border-dashed border-line bg-white py-10 text-center text-muted">No visits today for this filter.</p>
      )}
      {q.data && q.data.items.length > 0 && (
        <>
          <ul className="grid gap-3">
            {q.data.items.map(v => (
              <li key={v.visitId} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4 shadow-card">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-navy">{v.patient.fullName} <span className="text-sm font-normal text-muted">· {v.patient.patientCode}</span></p>
                  <p className="text-sm text-muted">To Dr. {v.doctor.fullName} · {timeOf(v.createdAt)}{v.reason ? ` · ${v.reason}` : ''}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-lav-light px-2.5 py-0.5 font-semibold text-violet">{v.visitCode}</span>
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${BADGE[v.status]}`}>{v.status.replace('_', ' ')}</span>
                  </div>
                </div>
                {v.status === 'waiting' && <Button variant="secondary" onClick={() => { setError(''); setTarget(v) }}>Cancel visit</Button>}
              </li>
            ))}
          </ul>
          <Pager total={q.data.total} offset={offset} onChange={setOffset} />
        </>
      )}

      {target && (
        <Modal open onClose={() => setTarget(null)} title={`Cancel ${target.visitCode}?`}>
          <p className="mb-4 text-sm text-muted">{target.patient.fullName} will be removed from Dr. {target.doctor.fullName}’s queue.</p>
          {error && <p role="alert" className="mb-3 text-sm text-err">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)}>Keep visit</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(target.visitId)}>Cancel visit</Button>
          </div>
        </Modal>
      )}
    </section>
  )
}