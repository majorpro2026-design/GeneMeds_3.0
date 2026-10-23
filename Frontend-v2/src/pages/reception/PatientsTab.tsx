import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { useDebounced } from '../../lib/useDebounced'
import { age, searchPatients, type PatientRef } from '../../lib/receptionApi'
import { ErrorBox, Pager } from '../admin/ui'
import { RegisterPatientModal } from './RegisterPatientModal'
import { StartVisitModal } from './StartVisitModal'

export function PatientsTab() {
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 300)
  const [offset, setOffset] = useState(0)
  const [registering, setRegistering] = useState(false)
  const [visitFor, setVisitFor] = useState<PatientRef | null>(null)

  const query = useQuery({
    queryKey: ['reception', 'patients', q, offset],
    queryFn: () => searchPatients({ q, offset }),
    placeholderData: keepPreviousData,
  })

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={text} onChange={e => { setText(e.target.value); setOffset(0) }}
            aria-label="Search patients" placeholder="Search by name, phone or GM-000001"
            className="h-10 w-full rounded-ctl border border-line bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
        </div>
        <Button variant="teal" onClick={() => setRegistering(true)}><UserPlus className="size-4" aria-hidden /> Register patient</Button>
      </div>

      {query.isError && <ErrorBox error={query.error} onRetry={() => void query.refetch()} />}
      {query.isPending && <p role="status" className="py-10 text-center text-muted">Loading patients…</p>}
      {query.data && query.data.items.length === 0 && (
        <p className="rounded-card border border-dashed border-line bg-white py-10 text-center text-muted">
          {q ? 'No patient matches your search.' : 'No patients registered yet.'}
        </p>
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <ul className="grid gap-3">
            {query.data.items.map(p => (
              <li key={p.patientId} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4 shadow-card">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-navy">{p.fullName}</p>
                  <p className="text-sm text-muted">{age(p.dob)} yrs · <span className="capitalize">{p.sex}</span> · {p.phone}</p>
                  <span className="mt-1 inline-block rounded-full bg-lav-light px-2.5 py-0.5 text-xs font-semibold text-violet">{p.patientCode}</span>
                </div>
                <Button variant="teal" onClick={() => setVisitFor({ patientId: p.patientId, patientCode: p.patientCode, fullName: p.fullName })}>Start visit</Button>
              </li>
            ))}
          </ul>
          <Pager total={query.data.total} offset={offset} onChange={setOffset} />
        </>
      )}

      {registering && (
        <RegisterPatientModal onClose={() => setRegistering(false)} onRegistered={p => { setRegistering(false); setVisitFor(p) }} />
      )}
      {visitFor && <StartVisitModal patient={visitFor} onClose={() => setVisitFor(null)} />}
    </section>
  )
}