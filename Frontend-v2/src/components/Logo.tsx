import { useId } from 'react'

type Tone = 'light' | 'splash' | 'dark'

const WORD: Record<Tone, { gene: string; meds: string; rung: string; strand2Start: string; strand2End: string }> = {
  light: {
    gene: 'text-navy',
    meds: 'text-violet',
    rung: 'rgba(109, 74, 216, 0.35)',
    strand2Start: '#7C3AED',
    strand2End: '#5B21B6',
  },
  splash: {
    gene: 'text-navy',
    meds: 'text-white',
    rung: 'rgba(255, 255, 255, 0.55)',
    strand2Start: '#FFFFFF',
    strand2End: '#E9E3FB',
  },
  dark: {
    gene: 'text-white',
    meds: 'text-amber-400',
    rung: 'rgba(255, 255, 255, 0.4)',
    strand2Start: '#FFFFFF',
    strand2End: '#F4F1FD',
  },
}

export interface LogoProps {
  size?: number
  wordmark?: boolean
  tone?: Tone
  layout?: 'row' | 'col'
  className?: string
}

export function Logo({
  size = 36,
  wordmark = true,
  tone = 'light',
  layout = 'row',
  className = '',
}: LogoProps) {
  const id = useId().replace(/:/g, '')
  const t = WORD[tone]

  return (
    <span
      className={`inline-flex items-center ${
        layout === 'col' ? 'flex-col gap-1.5' : 'flex-row gap-2.5'
      } ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="GeneMeds logo"
        className="shrink-0"
      >
        <defs>
          {/* Strand 1: Warm amber/gold gradient */}
          <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="35%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Strand 2: White (dark) or Violet (light) */}
          <linearGradient id={`accent-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.strand2Start} />
            <stop offset="100%" stopColor={t.strand2End} />
          </linearGradient>
        </defs>

        {/* Minimal connecting base-pair rungs */}
        <line x1="15" y1="9.5" x2="25" y2="9.5" stroke={t.rung} strokeWidth="2" strokeLinecap="round" />
        <line x1="13.5" y1="20" x2="26.5" y2="20" stroke={t.rung} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="15" y1="30.5" x2="25" y2="30.5" stroke={t.rung} strokeWidth="2" strokeLinecap="round" />

        {/* Strand 2 upper segment (passing behind Strand 1 at crossing 1, y=13) */}
        <path
          d="M 29 6 C 27 11, 13 15, 11 20"
          stroke={`url(#accent-${id})`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Strand 1 continuous double-helix strand (amber/gold) */}
        <path
          d="M 11 6 C 13 11, 27 15, 29 20 C 27 25, 13 29, 11 34"
          stroke={`url(#gold-${id})`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Strand 2 lower segment (passing in front of Strand 1 at crossing 2, y=27) */}
        <path
          d="M 11 20 C 13 25, 27 29, 29 34"
          stroke={`url(#accent-${id})`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>

      {wordmark && (
        <span className="font-heading text-xl font-semibold tracking-tight select-none leading-none">
          <span className={t.gene}>Gene</span>
          <span className={t.meds}>Meds</span>
        </span>
      )}
    </span>
  )
}