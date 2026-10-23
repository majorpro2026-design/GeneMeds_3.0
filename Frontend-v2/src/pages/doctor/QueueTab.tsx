import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { getQueue, startVisit, STATUS_BADGE, statusLabel } from '../../lib/doctorApi'
import { age, timeOf } from '../../lib/receptionApi'
import { ErrorBox } from '../admin/ui'

export function QueueTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [scope, setScope] = useState<'open' | 'done'>('open')

  const q = useQuery({ queryKey: ['doctor', 'queue', scope], queryFn: () => getQueue(scope), refetchInterval: 30_000 })
  const start = useMutation({
    mutationFn: (id: number) => startVisit(id),
    onSuccess: (_r, id) => { void qc.invalidateQueries({ queryKey: ['doctor'] }); nav(`/doctor/visit/${id}`) },
    onError: e => { toast(e instanceof Error ? e.message : 'Could not start.', 'error'); void qc.invalidateQueries({ queryKey: ['doctor'] }) },
  })

  const tab = (k: 'open' | 'done', label: string) => (
    <button role="tab" aria-selected={scope === k} onClick={() => setScope(k)}
      className={`h-9 rounded-ctl px-3.5 text-sm font-semibold transition ${scope === k ? 'bg-white text-violet shadow-card' : 'text-muted hover:text-ink'}`}>{label}</button>
  )

  return (
    <section>
      <div role="tablist" className="mb-4 flex w-fit gap-1 rounded-card border border-line bg-lav-pale p-1">{tab('open', 'Open visits')}{tab('done', 'Completed today')}</div>
      {q.isError && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.isPending && <p role="status" className="py-10 text-center text-muted">Loading your queue…</p>}
      {q.data && q.data.items.length === 0 && (
        <p className="rounded-card border border-dashed border-line bg-white py-10 text-center text-muted">
          {scope === 'open' ? 'No patients waiting.' : 'No completed visits today.'}
        </p>
      )}
      {q.data && q.data.items.length > 0 && (
        <ul className="grid gap-3">
          {q.data.items.map(v => (
            <li key={v.visitId} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4 shadow-card">
              <div className="min-w-0">
                <p className="font-heading font-bold text-navy">{v.patient.fullName} <span className="text-sm font-normal text-muted">· {v.patient.patientCode}</span></p>
                <p className="text-sm text-muted">{age(v.patient.dob)} yrs · <span className="capitalize">{v.patient.sex}</span> · arrived {timeOf(v.createdAt)}{v.reason ? ` · ${v.reason}` : ''}</p>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-lav-light px-2.5 py-0.5 font-semibold text-violet">{v.visitCode}</span>
                  <span className={`rounded-full px-2.5 py-0.5 font-semibold capitalize ${STATUS_BADGE[v.status]}`}>{statusLabel(v.status)}</span>
                </div>
              </div>
              {v.status === 'waiting' && (
                <Button loading={start.isPending && start.variables === v.visitId} onClick={() => start.mutate(v.visitId)}>Start consultation</Button>
              )}
              {v.status !== 'waiting' && (
                <Link to={`/doctor/visit/${v.visitId}`} className="inline-flex h-10 items-center rounded-ctl border border-line bg-lav-pale px-[18px] text-[13px] font-semibold text-violet hover:bg-lav-light">Open</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}