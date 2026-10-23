import { useId } from 'react'

type Tone = 'light' | 'splash' |'dark'
const WORD: Record<Tone, [string, string]> = {
  light: ['text-navy', 'text-violet'],
  splash: ['text-navy', 'text-white'],
  dark: ['text-white', 'text-gold'],
}

export function Logo({ size = 40, wordmark = true, tone = 'light' }: { size?: number; wordmark?: boolean; tone?: Tone }) {
  const id = useId().replace(/:/g, '') // unique gradient ids when the logo appears twice on a page
  const [a, b] = WORD[tone]
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size * 1.22} viewBox="0 0 120 146" role="img" aria-label="GeneMeds logo">
        <defs>
          <linearGradient id={`l${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#FFB93D" /></linearGradient>
          <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB020" /><stop offset="1" stopColor="#EE7F1F" /></linearGradient>
          <clipPath id={`a${id}`}><rect width="60" height="146" /></clipPath>
          <clipPath id={`b${id}`}><rect x="60" width="60" height="146" /></clipPath>
        </defs>
        <path d="M60 4 112 24v44c0 36-24 60-52 74C32 128 8 104 8 68V24Z" fill={`url(#l${id})`} clipPath={`url(#a${id})`} />
        <path d="M60 4 112 24v44c0 36-24 60-52 74C32 128 8 104 8 68V24Z" fill={`url(#r${id})`} clipPath={`url(#b${id})`} />
        <path d="M48 43H72M48 61H72M48 87H72M48 105H72" stroke="#1E1B3A" strokeOpacity=".4" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M42 30C42 52 78 52 78 74S42 96 42 118" fill="none" stroke="#1E1B3A" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M78 30C78 52 42 52 42 74S78 96 78 118" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      </svg>
      {wordmark && (
        <span className="font-brand text-xl font-extrabold tracking-tight">
          <span className={a}>Gene</span><span className={b}>Meds</span>
        </span>
      )}
    </span>
  )
}