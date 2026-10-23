import { api } from './api'

export type Status = 'pending' | 'active' | 'suspended' | 'rejected'
export type ManagedRole = 'doctor' | 'receptionist'
export type Action = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'reopen'

export type AdminUser = {
  id: number; fullName: string; email: string; phone: string | null
  role: ManagedRole; status: Status
  createdAt: string | null; approvedAt: string | null; approvedBy: number | null
  profile: Record<string, string | null>
  lastLoginAt: string | null
}
export type AuditEntry = {
  id: number; occurredAt: string | null; actorUserId: number | null; actorRole: string | null
  action: string; targetType: string | null; targetId: number | null
  reason: string | null; details: Record<string, unknown> | null
}
export type Page<T> = { total: number; limit: number; offset: number; items: T[] }

export const PAGE_SIZE = 20

function qs(p: Record<string, string | number | undefined>) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') s.set(k, String(v))
  return s.toString()
}

export const listUsers = (p: { status?: Status; role?: ManagedRole; q?: string; offset: number }) =>
  api<Page<AdminUser>>(`/api/admin/users?${qs({ ...p, limit: PAGE_SIZE })}`)

export const listAudit = (p: { action?: string; offset: number }) =>
  api<Page<AuditEntry>>(`/api/admin/audit-logs?${qs({ ...p, limit: PAGE_SIZE })}`)

export const decide = (id: number, action: Action, reason: string) =>
  api(`/api/admin/users/${id}/${action}`, { method: 'POST', body: reason ? { reason } : {} })

export const BY_STATUS: Record<Status, Action[]> = {
  pending: ['approve', 'reject'],
  active: ['suspend'],
  suspended: ['reactivate'],
  rejected: ['reopen'],
}

export const ACTION_META: Record<Action, {
  label: string; past: string; needsReason: boolean; variant: 'primary' | 'secondary' | 'danger'; hint: string
}> = {
  approve: { label: 'Approve', past: 'approved', needsReason: false, variant: 'primary', hint: 'The user will be able to sign in.' },
  reject: { label: 'Reject', past: 'rejected', needsReason: true, variant: 'danger', hint: 'The user cannot sign in. The reason is saved in the audit log.' },
  suspend: { label: 'Suspend', past: 'suspended', needsReason: true, variant: 'danger', hint: 'Active sessions end immediately. The reason is saved in the audit log.' },
  reactivate: { label: 'Reactivate', past: 'reactivated', needsReason: false, variant: 'secondary', hint: 'The user will be able to sign in again.' },
  reopen: { label: 'Reopen', past: 'moved back to pending', needsReason: false, variant: 'secondary', hint: 'The account returns to pending for a new review.' },
}

export function profileRows(u: AdminUser): [string, string | null][] {
  const p = u.profile
  return u.role === 'doctor'
    ? [['Registration no.', p.registrationNumber], ['Degrees', p.degrees], ['Hospital', p.hospitalName], ['Address', p.hospitalAddress]]
    : [['Degree', p.degree], ['Hospital', p.hospitalName], ['Address', p.hospitalAddress]]
}

export const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

export type AdminStats = {
  staffTotal: number; staffActive: number; pending: number
  doctors: number; doctorsActive: number; receptionists: number; receptionistsActive: number
  admins: number; patients: number; visitsToday: number
}
export const getStats = () => api<AdminStats>('/api/admin/stats')

export function ago(iso: string | null) {
  if (!iso) return 'Never signed in'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d} day${d === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString()
}