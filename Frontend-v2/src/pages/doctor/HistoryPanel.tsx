import { dateTime, STATUS_BADGE, statusLabel } from '../../lib/doctorApi'
import type { HistoryVisit } from '../../lib/rxApi'
import { ErrorBox } from '../admin/ui'

export function HistoryPanel({ items, loading, error, onRetry }: { items: HistoryVisit[] | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
  if (error) return <ErrorBox error={error} onRetry={onRetry} />
  if (loading) return <p role="status" className="py-10 text-center text-muted">Loading earlier visits…</p>
  if (!items || items.length === 0) {
    return <p className="rounded-card border border-dashed border-line bg-white py-10 text-center text-muted">No earlier completed visits with you.</p>
  }
  return (
    <ul className="grid gap-4">
      {items.map((v, i) => (
        <li key={v.visitId}>
          <details open={i === 0} className="group overflow-hidden rounded-card border border-line bg-white shadow-card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 hover:bg-lav-pale">
              <span className="rounded-full bg-lav-light px-2.5 py-0.5 text-xs font-bold text-violet">{v.visitCode}</span>
              <span className="font-semibold text-navy">{dateTime(v.createdAt)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_BADGE[v.status as keyof typeof STATUS_BADGE] ?? 'bg-slate-100 text-slate-700'}`}>{statusLabel(v.status as never)}</span>
              <span className="ml-auto text-sm text-muted">
                {v.prescription ? `${v.prescription.items.length} medicine${v.prescription.items.length === 1 ? '' : 's'}` : 'No prescription'}
                <span className="ml-2 inline-block transition group-open:rotate-180" aria-hidden>⌄</span>
              </span>
            </summary>
            <div className="border-t border-line p-5">
              <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Reason for visit</dt><dd>{v.reason || '—'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Diagnosis</dt><dd>{v.prescription?.diagnosis || '—'}</dd></div>
              </dl>
              {v.prescription && v.prescription.items.length > 0 ? (
                <div className="overflow-x-auto rounded-ctl border border-line">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-lav-pale text-xs uppercase tracking-wide text-muted">
                      <tr><th className="p-2.5">Medicine</th><th className="p-2.5">Dosage</th><th className="p-2.5">Frequency</th><th className="p-2.5">Duration</th></tr>
                    </thead>
                    <tbody>
                      {v.prescription.items.map((it, k) => (
                        <tr key={k} className="border-t border-line">
                          <td className="p-2.5"><p className="font-semibold text-navy">{it.drugName}</p>{it.genericName && <p className="text-xs text-muted">{it.genericName}</p>}</td>
                          <td className="p-2.5">{it.dosage}</td><td className="p-2.5">{it.frequency}</td><td className="p-2.5">{it.durationDays} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted">No prescription was saved for this visit.</p>}
              {v.prescription?.notes && <p className="mt-3 text-sm"><span className="font-semibold text-navy">Notes: </span>{v.prescription.notes}</p>}
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}