import { api } from './api'
import { PAGE_SIZE, type Page } from './adminApi'
import type { VisitStatus } from './receptionApi'

type Sex = 'male' | 'female' | 'other'
export type QueueVisit = {
  visitId: number; visitCode: string; status: VisitStatus; reason: string | null; createdAt: string
  patient: { patientId: number; patientCode: string; fullName: string; dob: string; sex: Sex; phone: string }
}
export type MyPatient = { patientId: number; patientCode: string; fullName: string; dob: string; sex: Sex; phone: string; visits: number; lastVisit: string | null }
export type VisitDetail = {
  visit: { visitId: number; visitCode: string; status: VisitStatus; reason: string | null; createdAt: string }
  patient: { patientId: number; patientCode: string; fullName: string; dob: string; sex: Sex; phone: string; email: string | null }
  previousVisits: { visitId: number; visitCode: string; status: VisitStatus; reason: string | null; createdAt: string }[]
}

export const getQueue = (scope: 'open' | 'done') => api<{ items: QueueVisit[] }>(`/api/doctor/queue?scope=${scope}`)
export const getVisit = (id: number) => api<VisitDetail>(`/api/doctor/visits/${id}`)
export const startVisit = (id: number) => api(`/api/doctor/visits/${id}/start`, { method: 'POST' })
export const completeVisit = (id: number) => api(`/api/doctor/visits/${id}/complete`, { method: 'POST' })
export const searchMyPatients = (p: { q: string; offset: number }) =>
  api<Page<MyPatient>>(`/api/doctor/patients?${new URLSearchParams({ q: p.q, offset: String(p.offset), limit: String(PAGE_SIZE) })}`)

export const STATUS_BADGE: Record<VisitStatus, string> = {
  waiting: 'bg-amber-100 text-amber-800', in_consultation: 'bg-sky-100 text-sky-800',
  completed: 'bg-green-100 text-green-800', cancelled: 'bg-slate-200 text-slate-700',
}
export const statusLabel = (s: VisitStatus) => s.replace('_', ' ')
export const dateTime = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })