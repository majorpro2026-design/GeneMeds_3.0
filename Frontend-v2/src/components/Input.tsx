import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; trailing?: ReactNode }

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, trailing, id, className = '', ...rest }, ref,
) {
  const uid = useId()
  const inputId = id ?? uid
  const noteId = `${inputId}-note`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold">
        {label}{rest.required && <b className="ml-0.5 text-err">*</b>}
      </label>
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          className={`h-10 w-full rounded-ctl border bg-white px-3 text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15 disabled:bg-lav-pale ${trailing ? 'pr-11' : ''} ${error ? 'border-err' : 'border-line'} ${className}`}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {(error || hint) && (
        <p id={noteId} role={error ? 'alert' : undefined} className={`text-xs ${error ? 'text-err' : 'text-muted'}`}>{error ?? hint}</p>
      )}
    </div>
  )
})