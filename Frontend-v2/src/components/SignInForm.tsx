import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { roleHome, type RoleKey } from '../lib/roles'
import { Button } from './Button'
import { Input } from './Input'

type V = { email: string; password: string }

export function SignInForm({ role, button }: { role: RoleKey; button: 'primary' | 'teal' | 'coral' }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>()
  const { login } = useAuth()
  const nav = useNavigate()
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = handleSubmit(async v => {
    setError('')
    try { await login(v.email.trim(), v.password, role); nav(roleHome(role), { replace: true }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign in failed.') }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" required
        error={errors.email?.message} {...register('email', { required: 'Enter your email.' })} />
      <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required
        error={errors.password?.message} {...register('password', { required: 'Enter your password.' })}
        trailing={<button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="grid size-8 place-items-center rounded text-muted hover:text-violet">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
      {error && <p role="alert" className="rounded-ctl border border-err/30 bg-err/10 px-3 py-2 text-sm text-err">{error}</p>}
      <Button type="submit" variant={button} loading={isSubmitting} className="h-11">Sign in</Button>
    </form>
  )
}