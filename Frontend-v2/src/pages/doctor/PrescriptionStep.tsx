import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Save, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { Logo } from '../../components/Logo'
import { useToast } from '../../components/Toast'
import type { VisitDetail } from '../../lib/doctorApi'
import { age } from '../../lib/receptionApi'
import { FREQUENCIES, saveRx, searchCatalog, type CatalogDrug, type SavedRx } from '../../lib/rxApi'
import { useDebounced } from '../../lib/useDebounced'

type Row = { key: string; drugName: string; generics: string[]; generic: string; dosage: string; frequency: string; duration: string }
let seq = 0
const newKey = () => `r${++seq}`
const field = 'h-10 w-full rounded-ctl border border-line bg-white px-3 text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15'
const GRID = 'md:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_7.5rem_2rem]'
const chip = 'inline-block rounded-full bg-lav-light px-2.5 py-0.5 text-xs font-semibold text-violet'

export function PrescriptionStep({ visit, saved, doctorName, onSaved }: { visit: VisitDetail; saved: SavedRx | null; doctorName: string; onSaved: (next: 2 | 3) => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const p = visit.patient
  const [rows, setRows] = useState<Row[]>(() => (saved?.items ?? []).map(i => ({
    key: newKey(), drugName: i.drugName, generics: i.genericName ? [i.genericName] : [], generic: i.genericName ?? '',
    dosage: i.dosage, frequency: i.frequency, duration: String(i.durationDays),
  })))
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [diagnosis, setDiagnosis] = useState(saved?.diagnosis ?? '')
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const q = useDebounced(text.trim(), 300)

  const res = useQuery({ queryKey: ['doctor', 'catalog', q], queryFn: () => searchCatalog(q), enabled: q.length >= 2 })
  const results = (res.data ?? []).filter(d => !rows.some(r => r.drugName.toLowerCase() === d.drugName.toLowerCase()))

  function add(d: CatalogDrug) {
    const generics = d.generics.length ? d.generics : d.genericName ? [d.genericName] : []
    setRows(rs => [...rs, { key: newKey(), drugName: d.drugName, generics, generic: generics[0] ?? '', dosage: '', frequency: '', duration: '' }])
    setText(''); setOpen(false)
  }
  const patch = (key: string, p2: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p2 } : r)))
  const valid = rows.length > 0 && rows.every(r => r.dosage.trim() && r.frequency && Number.isInteger(Number(r.duration)) && Number(r.duration) >= 1 && Number(r.duration) <= 3650)

  // next = 2: go to gene analysis, next = 3: go straight to the review sheet
  const m = useMutation({
    mutationFn: (_next: 2 | 3) => saveRx(visit.visit.visitId, {
      notes: notes.trim(), diagnosis: diagnosis.trim(),
      items: rows.map(r => ({ drugName: r.drugName, genericName: r.generic || null, dosage: r.dosage.trim(), frequency: r.frequency, durationDays: Number(r.duration) })),
    }),
    onSuccess: async (_r, next) => {
      toast('Prescription saved.', 'success')
      await qc.invalidateQueries({ queryKey: ['doctor', 'rx', visit.visit.visitId] })
      onSaved(next)
    },
    onError: e => setError(e instanceof Error ? e.message : 'Could not save the prescription.'),
  })
  const go = (next: 2 | 3) => { setError(''); m.mutate(next) }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="h-1.5 bg-gradient-to-r from-violet via-gene to-gold" />
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-lav p-6">
        <div className="flex items-center gap-5">
          <Logo size={44} />
          <div className="border-l border-line pl-5">
            <p className="font-heading text-lg font-bold text-navy">Dr. {doctorName}</p>
            <p className="text-xs text-muted">Prescription · {new Date().toLocaleDateString([], { dateStyle: 'long' })}</p>
          </div>
        </div>
        <div className="text-sm sm:text-right">
          <p className="font-heading font-bold text-navy">{p.fullName}</p>
          <p className="text-muted"><span>{age(p.dob)} yrs</span> · <span className="capitalize">{p.sex}</span> · {p.patientCode}</p>
        </div>
      </div>

      <div className="p-6">
        <label htmlFor="rx-diagnosis" className="mb-1.5 block text-[13px] font-semibold">Diagnosis <span className="font-normal text-muted">(optional)</span></label>
        <input id="rx-diagnosis" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} maxLength={500} placeholder="e.g. Acute bronchitis" className={`${field} mb-6`} />

        <div className="relative mb-6">
          <label htmlFor="drug-search" className="mb-1.5 block text-[13px] font-semibold">Add medicine</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="drug-search" value={text} autoComplete="off" placeholder="Search by brand or generic name (at least 2 letters)"
              onChange={e => { setText(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter') { e.preventDefault(); if (results[0]) add(results[0]) } }}
              className={`${field} h-11 pl-9`} />
          </div>
          {open && q.length >= 2 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-card border border-line bg-white shadow-pop">
              {res.isFetching && <li className="px-4 py-3 text-sm text-muted">Searching…</li>}
              {!res.isFetching && results.length === 0 && <li className="px-4 py-3 text-sm text-muted">No medicine matches “{q}”.</li>}
              {results.map(d => (
                <li key={d.drugId}>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => add(d)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-lav-pale">
                    <span><strong className="text-sm">{d.drugName}</strong><small className="block text-xs text-muted">{d.generics.join(', ')}</small></span>
                    <span className="text-xs font-bold text-violet">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-card border border-dashed border-line py-10 text-center text-sm text-muted">No medicines yet. Search above to start this prescription.</p>
        ) : (
          <>
            <div className={`hidden gap-3 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid ${GRID}`} aria-hidden>
              <span>#</span><span>Medicine</span><span>Dosage</span><span>Frequency</span><span>Duration</span><span />
            </div>
            <ol className="grid gap-3">
              {rows.map((r, i) => (
                <li key={r.key} className={`grid items-center gap-3 rounded-card border border-line bg-white p-4 transition hover:border-lav ${GRID}`}>
                  <span className="grid size-8 place-items-center rounded-full bg-lav-light font-heading text-sm font-bold text-violet">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-navy">{r.drugName}</p>
                    {r.generics.length > 1 ? (
                      <select aria-label={`Generic for ${r.drugName}`} value={r.generic} onChange={e => patch(r.key, { generic: e.target.value })} className={`${field} mt-1 h-8 text-xs`}>
                        {r.generics.map(g => <option key={g}>{g}</option>)}
                      </select>
                    ) : r.generic ? <span className={`${chip} mt-1`}>{r.generic}</span> : null}
                  </div>
                  <input aria-label={`Dosage for ${r.drugName}`} placeholder="e.g. 1 tablet" value={r.dosage} onChange={e => patch(r.key, { dosage: e.target.value })} maxLength={100} className={field} />
                  <select aria-label={`Frequency for ${r.drugName}`} value={r.frequency} onChange={e => patch(r.key, { frequency: e.target.value })} className={field}>
                    <option value="">Select…</option>{FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input aria-label={`Days for ${r.drugName}`} type="number" min={1} max={3650} placeholder="0" value={r.duration} onChange={e => patch(r.key, { duration: e.target.value })} className={`${field} w-20`} />
                    <span className="text-sm text-muted">days</span>
                  </div>
                  <button type="button" aria-label={`Remove ${r.drugName}`} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} className="grid size-8 place-items-center rounded text-muted hover:text-err">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}

        <label htmlFor="rx-notes" className="mb-1.5 mt-6 block text-[13px] font-semibold">Notes for the patient <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="rx-notes" rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Take after food. Avoid alcohol."
          className="w-full rounded-ctl border border-line p-3 text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-lav bg-lav-pale/60 p-6">
        <div className="w-56 border-t border-ink/40 pt-1 text-xs text-muted">Dr. {doctorName} · signature</div>
        <div className="flex flex-col items-end gap-2">
          {error && <p role="alert" className="text-sm text-err">{error}</p>}
          {!valid && rows.length > 0 && <p className="text-xs text-muted">Fill in dosage, frequency and days for every medicine.</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={!valid || m.isPending} loading={m.isPending && m.variables === 3} onClick={() => go(3)}>
              <Save className="size-4" aria-hidden /> Save prescription
            </Button>
            <Button disabled={!valid || m.isPending} loading={m.isPending && m.variables === 2} onClick={() => go(2)}>
              Save and recommend gene test <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}