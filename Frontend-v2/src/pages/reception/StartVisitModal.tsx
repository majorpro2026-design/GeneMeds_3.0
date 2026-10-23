import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { createVisit, listDoctors, type PatientRef } from '../../lib/receptionApi'

export function StartVisitModal({ patient, onClose }: { patient: PatientRef; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [doctorId, setDoctorId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const doctors = useQuery({ queryKey: ['reception', 'doctors'], queryFn: listDoctors })

  const m = useMutation({
    mutationFn: () => createVisit({ patientId: patient.patientId, doctorId: Number(doctorId), reason: reason.trim() || undefined }),
    onSuccess: r => {
      toast(`Visit ${r.visitCode} created for ${patient.fullName}.`, 'success')
      void qc.invalidateQueries({ queryKey: ['reception'] })
      onClose()
    },
    onError: e => setError(e instanceof Error ? e.message : 'Could not create the visit.'),
  })

  function submit() {
    if (!doctorId) { setError('Choose a doctor.'); return }
    setError('')
    m.mutate()
  }

  return (
    <Modal open onClose={onClose} title="Start visit">
      <p className="mb-4 text-sm text-muted">{patient.fullName} · {patient.patientCode}</p>
      <label htmlFor="doctor" className="mb-1.5 block text-[13px] font-semibold">Doctor <b className="text-err">*</b></label>
      {doctors.isPending && <p role="status" className="text-sm text-muted">Loading doctors…</p>}
      {doctors.isError && <p role="alert" className="text-sm text-err">Could not load doctors. Close and try again.</p>}
      {doctors.data && doctors.data.items.length === 0 && <p role="alert" className="text-sm text-err">No active doctors are available yet.</p>}
      {doctors.data && doctors.data.items.length > 0 && (
        <select id="doctor" value={doctorId} onChange={e => setDoctorId(e.target.value)}
          className="h-10 w-full rounded-ctl border border-line bg-white px-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15">
          <option value="">Select a doctor…</option>
          {doctors.data.items.map(d => <option key={d.id} value={d.id}>{d.fullName} · {d.openVisits} open</option>)}
        </select>
      )}
      <label htmlFor="reason" className="mb-1.5 mt-4 block text-[13px] font-semibold">Reason <span className="font-normal text-muted">(optional)</span></label>
      <textarea id="reason" rows={2} maxLength={300} value={reason} onChange={e => setReason(e.target.value)}
        className="w-full rounded-ctl border border-line p-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
      {error && <p role="alert" className="mt-2 text-sm text-err">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" loading={m.isPending} onClick={submit}>Create visit</Button>
      </div>
    </Modal>
  )
}