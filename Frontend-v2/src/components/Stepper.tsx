import { Check } from 'lucide-react'

export function Stepper({ steps, current, canGo, onGo }: { steps: string[]; current: number; canGo: (n: number) => boolean; onGo: (n: number) => void }) {
  return (
    <ol className="flex items-center print:hidden" aria-label="Visit steps">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button type="button" disabled={!canGo(n)} onClick={() => onGo(n)} aria-current={active ? 'step' : undefined}
              className="flex items-center gap-2.5 disabled:cursor-not-allowed">
              <span className={`grid size-9 place-items-center rounded-full border-2 text-sm font-bold transition ${
                active ? 'border-violet bg-violet text-white shadow-[0_0_0_5px_rgb(185_168_242/.35)]'
                : done ? 'border-ok bg-ok text-white' : 'border-line bg-white text-muted'}`}>
                {done ? <Check className="size-4" aria-hidden /> : n}
              </span>
              <span className={`hidden text-sm font-semibold sm:inline ${active ? 'text-violet' : done ? 'text-ok' : 'text-muted'}`}>{label}</span>
            </button>
            {n < steps.length && <span className={`mx-3 h-0.5 flex-1 rounded transition ${done ? 'bg-ok' : 'bg-line'}`} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}