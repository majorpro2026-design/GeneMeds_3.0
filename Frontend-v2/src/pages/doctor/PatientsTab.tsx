import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { dateTime, searchMyPatients } from '../../lib/doctorApi'
import { age } from '../../lib/receptionApi'
import { useDebounced } from '../../lib/useDebounced'
import { ErrorBox, Pager } from '../admin/ui'

export function PatientsTab() {
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 300)
  const [offset, setOffset] = useState(0)
  const query = useQuery({ queryKey: ['doctor', 'patients', q, offset], queryFn: () => searchMyPatients({ q, offset }), placeholderData: keepPreviousData })

  return (
    <section>
      <div className="relative mb-4 w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={text} onChange={e => { setText(e.target.value); setOffset(0) }} aria-label="Search my patients"
          placeholder="Search by name, phone or GM-000001"
          className="h-10 w-full rounded-ctl border border-line bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
      </div>
      {query.isError && <ErrorBox error={query.error} onRetry={() => void query.refetch()} />}
      {query.isPending && <p role="status" className="py-10 text-center text-muted">Loading patients…</p>}
      {query.data && query.data.items.length === 0 && (
        <p className="rounded-card border border-dashed border-line bg-white py-10 text-center text-muted">{q ? 'No patient matches your search.' : 'You have no patients yet.'}</p>
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <ul className="grid gap-3">
            {query.data.items.map(p => (
              <li key={p.patientId} className="rounded-card border border-line bg-white p-4 shadow-card">
                <p className="font-heading font-bold text-navy">{p.fullName}</p>
                <p className="text-sm text-muted">{age(p.dob)} yrs · <span className="capitalize">{p.sex}</span> · {p.phone}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-lav-light px-2.5 py-0.5 font-semibold text-violet">{p.patientCode}</span>
                  <span className="text-muted">{p.visits} visit{p.visits === 1 ? '' : 's'}{p.lastVisit ? ` · last ${dateTime(p.lastVisit)}` : ''}</span>
                </div>
              </li>
            ))}
          </ul>
          <Pager total={query.data.total} offset={offset} onChange={setOffset} />
        </>
      )}
    </section>
  )
}