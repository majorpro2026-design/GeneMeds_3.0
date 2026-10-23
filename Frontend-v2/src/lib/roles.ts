import { ClipboardList, HeartPulse, ShieldCheck, Stethoscope, type LucideIcon } from 'lucide-react'

export type RoleKey = 'admin' | 'doctor' | 'receptionist' | 'patient'

export const ROLES: {
  key: RoleKey; name: string; blurb: string; icon: LucideIcon; canRegister: boolean
  button: 'primary' | 'teal' | 'coral'; chip: string; hover: string; note?: string
}[] = [
  { key: 'admin', name: 'Admin', blurb: 'Approvals, audit logs and clinic settings', icon: ShieldCheck, canRegister: false, button: 'primary', chip: 'bg-admin/10 text-admin', hover: 'hover:border-admin', note: 'Admin accounts are created by the system owner and cannot be registered here.' },
  { key: 'doctor', name: 'Doctor', blurb: 'Prescribe with gene-drug guidance', icon: Stethoscope, canRegister: true, button: 'primary', chip: 'bg-violet/10 text-violet', hover: 'hover:border-violet' },
  { key: 'receptionist', name: 'Receptionist', blurb: 'Patient check-in and visit intake', icon: ClipboardList, canRegister: true, button: 'teal', chip: 'bg-teal/10 text-teal', hover: 'hover:border-teal' },
  { key: 'patient', name: 'Patient', blurb: 'Your reports and medication alerts', icon: HeartPulse, canRegister: false, button: 'coral', chip: 'bg-coral/10 text-coral', hover: 'hover:border-coral', note: 'Patient accounts are created by your clinic. Patient self-registration arrives in a later update.' },
]

export const roleHome = (role: string) => `/${role}`