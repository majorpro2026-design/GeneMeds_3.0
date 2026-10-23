import { api } from './api'
import { PAGE_SIZE, type Page } from './adminApi'

export type PatientRef = { patientId: number; patientCode: string; fullName: string }
export type Patient = PatientRef & { dob: string; sex: 'male' | 'female' | 'other'; phone: string; email: string | null; createdAt: string }
export type Doctor = { id: number; fullName: string; hospitalName: string | null; openVisits: number }
export type VisitStatus = 'waiting' | 'in_consultation' | 'completed' | 'cancelled'
export type Visit = {
  visitId: number; visitCode: string; status: VisitStatus; reason: string | null; createdAt: string
  patient: PatientRef; doctor: { id: number; fullName: string }
}

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') s.set(k, String(v))
  return s.toString()
}

export const searchPatients = (p: { q: string; offset: number }) =>
  api<Page<Patient>>(`/api/reception/patients?${qs({ ...p, limit: PAGE_SIZE })}`)
export const listDoctors = () => api<{ items: Doctor[] }>('/api/reception/doctors')
export const listVisits = (p: { status?: VisitStatus; offset: number }) =>
  api<Page<Visit>>(`/api/reception/visits?${qs({ ...p, limit: PAGE_SIZE })}`)

export const createPatient = (body: { fullName: string; dob: string; sex: string; phone: string; email: string }) =>
  api<{ patientId: number; patientCode: string }>('/api/reception/patients', { method: 'POST', body })
export const createVisit = (body: { patientId: number; doctorId: number; reason?: string }) =>
  api<{ visitId: number; visitCode: string }>('/api/reception/visits', { method: 'POST', body })
export const cancelVisit = (id: number) => api(`/api/reception/visits/${id}/cancel`, { method: 'POST' })

export function age(dob: string) {
  const d = new Date(dob), n = new Date()
  let a = n.getFullYear() - d.getFullYear()
  const m = n.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--
  return a
}
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })