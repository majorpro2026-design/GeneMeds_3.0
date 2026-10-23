import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { Button } from './Button'
import { Input } from './Input'
import { Modal } from './Modal'

type R = 'doctor' | 'receptionist'
const EXTRA: Record<R, [name: string, label: string, min: number][]> = {
  doctor: [['registrationNumber', 'Doctor registration ID', 3], ['degrees', 'Degrees (e.g. MBBS, MD)', 2], ['hospitalName', 'Hospital (currently working)', 2], ['hospitalAddress', 'Hospital address', 5]],
  receptionist: [['degree', 'Degree', 2], ['hospitalName', 'Hospital name', 2], ['hospitalAddress', 'Hospital address', 5]],
}
const RULES: [string, (v: string) => boolean][] = [
  ['8 to 128 characters', v => v.length >= 8 && v.length <= 128],
  ['A letter', v => /[A-Za-z]/.test(v)],
  ['A digit', v => /[0-9]/.test(v)],
  ['A symbol', v => /[^A-Za-z0-9\s]/.test(v)],
]

export function RegisterForm({ role, button, onRegistered }: { role: R; button: 'primary' | 'teal' | 'coral'; onRegistered: () => void }) {
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<Record<string, string>>()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const pw = watch('password') ?? ''
  const passed = RULES.filter(([, f]) => f(pw)).length
  const err = (n: string) => errors[n]?.message as string | undefined

  const onSubmit = handleSubmit(async v => {
    setError('')
    try { await api(`/api/auth/register/${role}`, { method: 'POST', body: v }); reset(); setDone(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'Registration failed.') }
  })

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required autoComplete="name" error={err('fullName')}
          {...register('fullName', { required: 'Enter your full name.', minLength: { value: 2, message: 'At least 2 characters.' }, maxLength: { value: 120, message: 'Too long.' } })} />
        <Input label="Email" type="email" required autoComplete="email" error={err('email')}
          {...register('email', { required: 'Enter your email.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email.' } })} />
        <Input label="Phone number" type="tel" required autoComplete="tel" placeholder="+91 98765 43210" error={err('phone')}
          {...register('phone', { required: 'Enter your phone number.', pattern: { value: /^\+?[0-9][0-9 ()-]{6,19}$/, message: 'Enter a valid phone number.' } })} />
        {EXTRA[role].map(([name, label, min]) => (
          <Input key={name} label={label} required error={err(name)} className={name === 'hospitalAddress' ? '' : ''}
            {...register(name, { required: 'This field is required.', minLength: { value: min, message: `At least ${min} characters.` } })} />
        ))}
        <Input label="Create password" type="password" required autoComplete="new-password" error={err('password')}
          {...register('password', { required: 'Create a password.', validate: v => RULES.every(([, f]) => f(v)) || 'Password does not meet the rules below.' })} />
        <Input label="Confirm password" type="password" required autoComplete="new-password" error={err('confirmPassword')}
          {...register('confirmPassword', { required: 'Confirm your password.', validate: (v, all) => v === all.password || 'Passwords do not match.' })} />

        <div className="sm:col-span-2">
          <div className="mb-2 grid grid-cols-4 gap-1" aria-hidden>
            {[1, 2, 3, 4].map(i => <i key={i} className={`h-1 rounded ${i <= passed ? (passed < 4 ? 'bg-warn' : 'bg-ok') : 'bg-line'}`} />)}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {RULES.map(([label, f]) => <li key={label} className={f(pw) ? 'text-ok' : 'text-muted'}>{f(pw) ? '✓' : '○'} {label}</li>)}
          </ul>
        </div>

        {error && <p role="alert" className="rounded-ctl border border-err/30 bg-err/10 px-3 py-2 text-sm text-err sm:col-span-2">{error}</p>}
        <Button type="submit" variant={button} loading={isSubmitting} className="h-11 sm:col-span-2">Create account</Button>
        <p className="text-xs text-muted sm:col-span-2">An admin reviews new accounts before you can sign in.</p>
      </form>
      <Modal open={done} onClose={() => { setDone(false); onRegistered() }} title="Registration received">
        <p className="mb-5 text-muted">Your account is awaiting admin approval. You can sign in once it is approved.</p>
        <Button className="w-full" onClick={() => { setDone(false); onRegistered() }}>Done</Button>
      </Modal>
    </>
  )
}