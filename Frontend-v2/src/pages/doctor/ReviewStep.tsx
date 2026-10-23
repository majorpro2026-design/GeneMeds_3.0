import { ArrowLeft, Check, Printer } from 'lucide-react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { VisitDetail } from '../../lib/doctorApi'
import { age, type VisitStatus } from '../../lib/receptionApi'
import type { SavedRx } from '../../lib/rxApi'
import { Logo } from '../../components/Logo'

export function ReviewStep({ visit, rx, doctorName, status, finishing, onBack, onFinish }: {
  visit: VisitDetail; rx: SavedRx | null; doctorName: string; status: VisitStatus; finishing: boolean; onBack: () => void; onFinish: () => void
}) {
  const p = visit.patient
  return (
    <div className="grid gap-5">
      {!rx ? (
        <Card className="text-center text-muted">No prescription was saved for this visit.</Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
          <div className="h-1.5 bg-gradient-to-r from-violet via-gene to-gold" />
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-lav p-6">
            <div className="flex items-center gap-5">
                  <Logo size={44} />
              <div className="border-l border-line pl-5"><p className="font-heading text-lg font-bold text-navy">Dr. {doctorName}</p><p className="text-xs text-muted">{visit.visit.visitCode} · {new Date().toLocaleDateString([], { dateStyle: 'long' })}</p></div>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-heading font-bold text-navy">{p.fullName}</p>
              <p className="text-muted">{age(p.dob)} yrs · <span className="capitalize">{p.sex}</span> · {p.patientCode}</p>
            </div>
          </div>
          <div className="overflow-x-auto p-6">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead><tr className="border-b-2 border-navy/80 text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-3">#</th><th className="pr-3">Medicine</th><th className="pr-3">Dosage</th><th className="pr-3">Frequency</th><th>Duration</th></tr></thead>
              <tbody>
                {rx.items.map((it, i) => (
                  <tr key={i} className="border-b border-dashed border-line align-top">
                    <td className="py-3 pr-3 font-heading font-bold text-violet">{i + 1}</td>
                    <td className="pr-3"><p className="font-semibold text-navy">{it.drugName}</p>{it.genericName && <p className="text-xs text-muted">{it.genericName}</p>}</td>
                    <td className="pr-3">{it.dosage}</td><td className="pr-3">{it.frequency}</td><td>{it.durationDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rx.diagnosis && <p className="mt-5 text-sm"><span className="font-semibold text-navy">Diagnosis: </span>{rx.diagnosis}</p>}
            {rx.notes && <p className="mt-5 text-sm"><span className="font-semibold text-navy">Notes: </span>{rx.notes}</p>}
            <div className="mt-12 flex justify-end"><div className="w-56 border-t border-ink/40 pt-1 text-xs text-muted">Dr. {doctorName} · signature</div></div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-3 print:hidden">
        {status === 'in_consultation' ? <Button variant="secondary" onClick={onBack}><ArrowLeft className="size-4" aria-hidden /> Back</Button> : <span />}
        <div className="flex gap-3">
          {rx && <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>}
          {status === 'in_consultation' && <Button loading={finishing} onClick={onFinish}><Check className="size-4" aria-hidden /> Finish visit</Button>}
        </div>
      </div>
    </div>
  )
}