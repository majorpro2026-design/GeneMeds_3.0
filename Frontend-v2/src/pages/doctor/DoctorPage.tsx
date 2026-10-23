import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Hourglass, Stethoscope, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { AppShell } from '../../components/AppShell'
import { getQueue } from '../../lib/doctorApi'
import { ChatWidget } from './ChatWidget'
import { PatientsTab } from './PatientsTab'
import { QueueTab } from './QueueTab'

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number | string; tone: string }) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-line bg-white p-4 shadow-card">
      <span className={`grid size-12 place-items-center rounded-card ${tone}`}><Icon className="size-6" aria-hidden /></span>
      <div><p className="font-heading text-2xl font-extrabold leading-none text-navy">{value}</p><p className="mt-1 text-xs font-semibold text-muted">{label}</p></div>
    </div>
  )
}

export function DoctorPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'queue' | 'patients'>('queue')
  const open = useQuery({ queryKey: ['doctor', 'queue', 'open'], queryFn: () => getQueue('open'), refetchInterval: 30_000 })
  const done = useQuery({ queryKey: ['doctor', 'queue', 'done'], queryFn: () => getQueue('done'), refetchInterval: 30_000 })
  const items = open.data?.items ?? []
  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  const btn = (k: 'queue' | 'patients', label: string) => (
    <button role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === k ? 'border-violet text-violet' : 'border-transparent text-muted hover:text-ink'}`}>{label}</button>
  )
  return (
    <AppShell roleLabel="Doctor" tabs={<div role="tablist" className="flex">{btn('queue', 'My queue')}{btn('patients', 'My patients')}</div>}>
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-extrabold">{greet}, Dr. {user?.fullName}</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile icon={Hourglass} label="Waiting" value={open.data ? items.filter(v => v.status === 'waiting').length : '–'} tone="bg-amber-100 text-amber-800" />
          <Tile icon={Stethoscope} label="In consultation" value={open.data ? items.filter(v => v.status === 'in_consultation').length : '–'} tone="bg-sky-100 text-sky-800" />
          <Tile icon={CircleCheck} label="Completed today" value={done.data ? done.data.items.length : '–'} tone="bg-green-100 text-green-800" />
        </div>
      </div>
      {tab === 'queue' ? <QueueTab /> : <PatientsTab />}
      <ChatWidget drugs={[]} />
    </AppShell>
  )
}