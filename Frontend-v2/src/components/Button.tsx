import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'teal' | 'coral' | 'danger'
const V: Record<Variant, string> = {
  primary: 'bg-violet text-white hover:bg-violet-hover',
  secondary: 'bg-lav-pale text-violet border border-line hover:bg-lav-light',
  ghost: 'text-ink hover:bg-lav-pale hover:text-violet',
  teal: 'bg-teal-btn text-white hover:brightness-90',
  coral: 'bg-coral-btn text-white hover:brightness-90',
  danger: 'bg-err text-white hover:brightness-90',
}
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }

export function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-ctl px-[18px] text-[13px] font-semibold transition duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${V[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}