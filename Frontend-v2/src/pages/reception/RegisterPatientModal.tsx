import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { createPatient, type PatientRef } from '../../lib/receptionApi'

type V = { fullName: string; dob: string; sex: string; phone: string; email: string }

export function RegisterPatientModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: (p: PatientRef) => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, formState: { errors } } = useForm<V>({ defaultValues: { sex: '' } })
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const m = useMutation({
    mutationFn: (v: V) => createPatient({ ...v, fullName: v.fullName.trim(), phone: v.phone.trim(), email: v.email.trim() }),
    onSuccess: (r, v) => {
      toast(`Patient registered: ${r.patientCode}`, 'success')
      void qc.invalidateQueries({ queryKey: ['reception', 'patients'] })
      onRegistered({ patientId: r.patientId, patientCode: r.patientCode, fullName: v.fullName.trim() })
    },
    onError: e => setError(e instanceof Error ? e.message : 'Registration failed.'),
  })

  return (
    <Modal open onClose={onClose} title="Register patient" wide>
      <form onSubmit={handleSubmit(v => { setError(''); m.mutate(v) })} noValidate className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Full name" required autoComplete="off" error={errors.fullName?.message}
            {...register('fullName', { required: 'Enter the patient’s full name.', minLength: { value: 2, message: 'At least 2 characters.' }, maxLength: { value: 120, message: 'Too long.' } })} />
        </div>
        <Input label="Date of birth" type="date" max={today} required error={errors.dob?.message}
          {...register('dob', { required: 'Enter the date of birth.', validate: v => v <= today || 'Date cannot be in the future.' })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sex" className="text-[13px] font-semibold">Sex<b className="ml-0.5 text-err">*</b></label>
          <select id="sex" aria-invalid={errors.sex ? true : undefined}
            className={`h-10 rounded-ctl border bg-white px-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15 ${errors.sex ? 'border-err' : 'border-line'}`}
            {...register('sex', { required: 'Choose one.' })}>
            <option value="">Select…</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
          </select>
          {errors.sex && <p role="alert" className="text-xs text-err">{errors.sex.message}</p>}
        </div>
        <Input label="Phone number" type="tel" required placeholder="+91 98765 43210" error={errors.phone?.message}
          {...register('phone', { required: 'Enter a phone number.', pattern: { value: /^\+?[0-9][0-9 ()-]{6,19}$/, message: 'Enter a valid phone number.' } })} />
        <Input label="Email (optional)" type="email" error={errors.email?.message}
          {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} />
        {error && <p role="alert" className="rounded-ctl border border-err/30 bg-err/10 px-3 py-2 text-sm text-err sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="teal" loading={m.isPending}>Register patient</Button>
        </div>
      </form>
    </Modal>
  )
}