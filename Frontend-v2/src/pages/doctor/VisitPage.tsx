import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { AppShell } from '../../components/AppShell'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Modal } from '../../components/Modal'
import { Stepper } from '../../components/Stepper'
import { useToast } from '../../components/Toast'
import { completeVisit, getVisit, startVisit, STATUS_BADGE, statusLabel } from '../../lib/doctorApi'
import { age } from '../../lib/receptionApi'
import { getHistory, getRx } from '../../lib/rxApi'
import { ErrorBox } from '../admin/ui'
import { ChatWidget } from './ChatWidget'
import { GeneStep, type DiagnosticData } from './GeneStep'
import { HistoryPanel } from './HistoryPanel'
import { PrescriptionStep } from './PrescriptionStep'
import { ReviewStep } from './ReviewStep'

export function VisitPage() {
  const id = Number(useParams().id)
  const valid = Number.isInteger(id) && id > 0
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<'visit' | 'history'>('visit')
  const [step, setStep] = useState(1)
  const [confirm, setConfirm] = useState(false)

  const [diag, setDiag] = useState<DiagnosticData>(() => {
    try {
      const raw = sessionStorage.getItem(`gm_diag_${id}`)
      return raw ? JSON.parse(raw) : { tests: [], diplotypes: {}, results: [] }
    } catch {
      return { tests: [], diplotypes: {}, results: [] }
    }
  })

  const handleDiagNext = (data: DiagnosticData) => {
    setDiag(data)
    try {
      sessionStorage.setItem(`gm_diag_${id}`, JSON.stringify(data))
    } catch {}
    setStep(3)
  }

  const q = useQuery({ queryKey: ['doctor', 'visit', id], queryFn: () => getVisit(id), enabled: valid })
  const rxq = useQuery({ queryKey: ['doctor', 'rx', id], queryFn: () => getRx(id), enabled: valid })
  const hist = useQuery({ queryKey: ['doctor', 'history', id], queryFn: () => getHistory(id), enabled: valid })
  const d = q.data
  const rx = rxq.data?.prescription ?? null
  const status = d?.visit.status
  const current = status === 'completed' ? 3 : step
  const name = user?.fullName ?? ''

  const refresh = () => qc.invalidateQueries({ queryKey: ['doctor'] })
  const fail = (e: unknown) => { toast(e instanceof Error ? e.message : 'Action failed.', 'error'); setConfirm(false); void refresh() }
  const start = useMutation({ mutationFn: () => startVisit(id), onSuccess: () => { toast('Consultation started.', 'success'); void refresh() }, onError: fail })
  const finish = useMutation({ mutationFn: () => completeVisit(id), onSuccess: () => { toast('Visit completed.', 'success'); void refresh(); nav('/doctor') }, onError: fail })
  const canGo = (n: number) => (status === 'completed' ? n === 3 : n === 1 || rx !== null)
  const initials = (d?.patient.fullName ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const tabBtn = (k: 'visit' | 'history', label: string) => (
    <button role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`h-9 rounded-ctl px-4 text-sm font-semibold transition ${tab === k ? 'bg-white text-violet shadow-card' : 'text-muted hover:text-ink'}`}>{label}</button>
  )

  return (
    <AppShell roleLabel="Doctor">
      <Link to="/doctor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-violet print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Back to my queue
      </Link>
      {q.isError && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {rxq.isError && <ErrorBox error={rxq.error} onRetry={() => void rxq.refetch()} />}
      {valid && q.isPending && <p role="status" className="py-10 text-center text-muted">Loading visit…</p>}

      {d && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-4 rounded-card bg-gradient-to-r from-navy to-violet p-5 text-white shadow-card print:hidden">
            <span className="grid size-14 place-items-center rounded-full bg-white/15 font-heading text-lg font-extrabold">{initials}</span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold text-white">{d.patient.fullName}</h1>
              <p className="text-sm text-white/80">{age(d.patient.dob)} yrs · <span className="capitalize">{d.patient.sex}</span> · {d.patient.phone}{d.patient.email ? ` · ${d.patient.email}` : ''}</p>
              <p className="mt-1 text-sm text-white/80">Reason: {d.visit.reason || '—'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/20 px-3 py-1">{d.patient.patientCode}</span>
              <span className="rounded-full bg-white/20 px-3 py-1">{d.visit.visitCode}</span>
              <span className={`rounded-full px-3 py-1 capitalize ${STATUS_BADGE[d.visit.status]}`}>{statusLabel(d.visit.status)}</span>
            </div>
          </div>

          <div role="tablist" className="flex w-fit gap-1 rounded-card border border-line bg-lav-pale p-1 print:hidden">
            {tabBtn('visit', 'This visit')}
            {tabBtn('history', `Earlier visits${hist.data ? ` (${hist.data.items.length})` : ''}`)}
          </div>

          {tab === 'history' ? (
            <HistoryPanel items={hist.data?.items} loading={hist.isPending} error={hist.error} onRetry={() => void hist.refetch()} />
          ) : status === 'waiting' ? (
            <Card className="text-center">
              <p className="font-heading text-lg font-bold text-navy">This patient is waiting</p>
              <p className="mb-4 text-sm text-muted">Start the consultation to write a prescription. You can review earlier visits first.</p>
              <Button loading={start.isPending} onClick={() => start.mutate()}>Start consultation</Button>
            </Card>
          ) : (
            <div className="grid gap-5">
              {status === 'in_consultation' && <Stepper steps={['Prescription', 'Gene analysis', 'Review']} current={current} canGo={canGo} onGo={setStep} />}
              {current === 1 && rxq.isSuccess && <PrescriptionStep visit={d} saved={rx} doctorName={name} onSaved={n => setStep(n)} />}
              {current === 2 && rx && (
                <GeneStep
                  visit={d}
                  rx={rx}
                  initialData={diag}
                  onBack={() => setStep(1)}
                  onNext={handleDiagNext}
                />
              )}
              {current === 3 && (rxq.isSuccess || status === 'completed') && (
                <ReviewStep
                  visit={d}
                  rx={rx}
                  doctorName={name}
                  status={d.visit.status}
                  finishing={finish.isPending}
                  diagnosticData={diag}
                  onBack={() => setStep(rx ? 2 : 1)}
                  onFinish={() => setConfirm(true)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {confirm && (
        <Modal open onClose={() => setConfirm(false)} title="Finish this visit?">
          <p className="mb-4 text-sm text-muted">The visit moves out of your open queue and the prescription is locked.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Not yet</Button>
            <Button loading={finish.isPending} onClick={() => finish.mutate()}>Finish visit</Button>
          </div>
        </Modal>
      )}
      <ChatWidget drugs={(rx?.items ?? []).map(i => i.genericName ?? i.drugName)} />
    </AppShell>
  )
}