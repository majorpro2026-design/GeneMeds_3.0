import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ClipboardList, HeartPulse, Search, ShieldCheck, Stethoscope, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { ACTION_META, ago, BY_STATUS, fmt, getStats, listUsers, type Action, type AdminUser, type ManagedRole, type Status } from '../../lib/adminApi'
import { useDebounced } from '../../lib/useDebounced'
import { ActionModal } from './ActionModal'
import { ErrorBox, Pager } from './ui'

const TABS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'All users' }, { key: 'pending', label: 'Pending review' }, { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' }, { key: 'rejected', label: 'Rejected' },
]
const STATUS: Record<Status, { chip: string; dot: string }> = {
  pending: { chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  active: { chip: 'bg-green-100 text-green-800', dot: 'bg-green-600' },
  suspended: { chip: 'bg-slate-200 text-slate-700', dot: 'bg-slate-500' },
  rejected: { chip: 'bg-red-100 text-red-800', dot: 'bg-red-600' },
}
const ROLE: Record<ManagedRole, { chip: string; avatar: string; Icon: LucideIcon }> = {
  doctor: { chip: 'bg-violet/10 text-violet', avatar: 'bg-lav-light text-violet', Icon: Stethoscope },
  receptionist: { chip: 'bg-teal/10 text-teal-btn', avatar: 'bg-teal/15 text-teal-btn', Icon: ClipboardList },
}
const GRID = 'md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)]'

function Tile({ icon: Icon, label, value, sub, tone, badge }: { icon: LucideIcon; label: string; value: number | string; sub: string; tone: string; badge?: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted">{label}</p>
        <span className={`grid size-9 place-items-center rounded-ctl ${tone}`}><Icon className="size-[18px]" aria-hidden /></span>
      </div>
      <p className="mt-3 font-heading text-4xl font-extrabold leading-none text-navy">{value}</p>
      <p className="mt-2 text-xs font-semibold text-muted">{sub}</p>
      {badge && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">{badge}</span>}
    </div>
  )
}

export function UsersTab() {
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [role, setRole] = useState<ManagedRole | ''>('')
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 300)
  const [offset, setOffset] = useState(0)
  const [target, setTarget] = useState<{ user: AdminUser; action: Action } | null>(null)

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: getStats })
  const s = stats.data
  const num = (n: number | undefined) => (n === undefined ? '–' : n)

  const list = useQuery({
    queryKey: ['admin', 'users', status, role, q, offset],
    queryFn: () => listUsers({ status: status === 'all' ? undefined : status, role: role || undefined, q, offset }),
    placeholderData: keepPreviousData,
  })

  return (
    <section>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-violet">Clinical administration</p>
        <h1 className="text-3xl font-extrabold tracking-tight">User directory</h1>
        <p className="mt-1 text-muted">Review registrations and manage who can sign in to GeneMeds.</p>
      </div>

      {stats.isError && <div className="mb-4"><ErrorBox error={stats.error} onRetry={() => void stats.refetch()} /></div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile icon={Users} label="Staff accounts" value={num(s?.staffTotal)} sub={s ? `${s.staffActive} active` : 'Loading…'} tone="bg-lav-light text-violet" badge={s && s.pending > 0 ? `${s.pending} pending approval` : undefined} />
        <Tile icon={Stethoscope} label="Doctors" value={num(s?.doctors)} sub={s ? `${s.doctorsActive} active prescribers` : 'Loading…'} tone="bg-violet/10 text-violet" />
        <Tile icon={ClipboardList} label="Receptionists" value={num(s?.receptionists)} sub={s ? `${s.receptionistsActive} active` : 'Loading…'} tone="bg-teal/10 text-teal-btn" />
        <Tile icon={HeartPulse} label="Patients" value={num(s?.patients)} sub={s ? `${s.visitsToday} visit${s.visitsToday === 1 ? '' : 's'} today` : 'Loading…'} tone="bg-coral/10 text-coral-btn" />
        <Tile icon={ShieldCheck} label="Administrators" value={num(s?.admins)} sub="System admins" tone="bg-admin/10 text-admin" />
      </div>

      <div className="rounded-card border border-line bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" value={text} onChange={e => { setText(e.target.value); setOffset(0) }} aria-label="Search users" placeholder="Search by name or email"
              className="h-10 w-full rounded-ctl border border-line bg-white pl-9 pr-3 text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Role
            <select value={role} onChange={e => { setRole(e.target.value as ManagedRole | ''); setOffset(0) }}
              className="h-10 rounded-ctl border border-line bg-white px-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15">
              <option value="">All roles</option><option value="doctor">Doctor</option><option value="receptionist">Receptionist</option>
            </select>
          </label>
        </div>
        <div role="tablist" className="mx-5 mb-4 flex w-fit max-w-full flex-wrap gap-1 rounded-card border border-line bg-lav-pale p-1">
          {TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => { setStatus(t.key); setOffset(0) }}
              className={`flex h-9 items-center gap-2 rounded-ctl px-3.5 text-sm font-semibold transition ${status === t.key ? 'bg-white text-violet shadow-card' : 'text-muted hover:text-ink'}`}>
              {t.label}
              {t.key === 'pending' && s && s.pending > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{s.pending}</span>}
            </button>
          ))}
        </div>

        {list.isError && <div className="px-5 pb-4"><ErrorBox error={list.error} onRetry={() => void list.refetch()} /></div>}
        {list.isPending && <p role="status" className="py-10 text-center text-muted">Loading users…</p>}
        {list.data && list.data.items.length === 0 && <p className="border-t border-line py-10 text-center text-muted">No users match these filters.</p>}
        {list.data && list.data.items.length > 0 && (
          <>
            <div className={`hidden gap-4 border-y border-line bg-lav-pale px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-muted md:grid ${GRID}`} aria-hidden>
              <span>User</span><span>Role</span><span>Status</span><span>Last seen</span><span>Actions</span>
            </div>
            <ul>
              {list.data.items.map(u => {
                const r = ROLE[u.role]
                const st = STATUS[u.status]
                const detail = (u.role === 'doctor' ? [u.profile.registrationNumber && `Reg. ${u.profile.registrationNumber}`, u.profile.hospitalName] : [u.profile.degree, u.profile.hospitalName]).filter(Boolean).join(' · ')
                const initials = u.fullName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                return (
                  <li key={u.id} className={`grid items-center gap-3 border-t border-line px-5 py-4 first:border-t-0 md:gap-4 ${GRID} ${u.status === 'pending' ? 'bg-amber-50/70' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-full font-heading text-sm font-extrabold ${r.avatar}`}>{initials}</span>
                      <div className="min-w-0">
                        <p className="truncate font-heading font-bold text-navy">{u.fullName}</p>
                        <p className="truncate text-sm text-muted">{u.email}</p>
                        {detail && <p className="truncate text-xs text-muted">{detail}</p>}
                      </div>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${r.chip}`}><r.Icon className="size-3.5" aria-hidden />{u.role}</span>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${st.chip}`}><i className={`size-1.5 rounded-full ${st.dot}`} aria-hidden />{u.status}</span>
                    <div className="text-sm"><p className="font-semibold">{ago(u.lastLoginAt)}</p><p className="text-xs text-muted">Registered {fmt(u.createdAt)}</p></div>
                    <div className="flex flex-wrap gap-2">
                      {BY_STATUS[u.status].map(a => (
                        <Button key={a} variant={ACTION_META[a].variant} onClick={() => setTarget({ user: u, action: a })}>{ACTION_META[a].label}</Button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-line px-5 pb-5"><Pager total={list.data.total} offset={offset} onChange={setOffset} /></div>
          </>
        )}
      </div>
      {target && <ActionModal user={target.user} action={target.action} onClose={() => setTarget(null)} />}
    </section>
  )
}
