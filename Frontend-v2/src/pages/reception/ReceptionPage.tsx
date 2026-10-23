import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/Button'
import { Logo } from '../../components/Logo'
import { PatientsTab } from './PatientsTab'
import { QueueTab } from './QueueTab'

export function ReceptionPage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState<'queue' | 'patients'>('queue')

  const tabBtn = (k: 'queue' | 'patients', label: string) => (
    <button role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === k ? 'border-teal-btn text-teal-btn' : 'border-transparent text-muted hover:text-ink'}`}>{label}</button>
  )

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Logo size={30} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">Reception · {user?.fullName}</span>
            <Button variant="secondary" onClick={async () => { await logout(); nav('/roles') }}>Sign out</Button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5"><div role="tablist" className="flex">{tabBtn('queue', 'Today’s queue')}{tabBtn('patients', 'Patients')}</div></div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{tab === 'queue' ? <QueueTab /> : <PatientsTab />}</main>
    </div>
  )
}