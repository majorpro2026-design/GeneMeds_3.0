import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Logo } from '../components/Logo'

const SEEN = 'gm-splash-seen'

export function Splash() {
  const nav = useNavigate()
  const seen = sessionStorage.getItem(SEEN) === '1'
  const go = () => { sessionStorage.setItem(SEEN, '1'); nav('/roles', { replace: true }) }

  useEffect(() => {
    if (seen) return
    const t = setTimeout(go, 3000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (seen) return <Navigate to="/roles" replace />
  return (
    <main className="relative grid min-h-screen place-items-center bg-[#9479E6] px-6 text-center">
      <div className="flex flex-col items-center gap-5">
        <div className="pop"><Logo size={110} wordmark={false} tone="splash" /></div>
        <h1 className="rise font-brand text-[clamp(52px,11vw,104px)] font-extrabold leading-none tracking-tighter" style={{ animationDelay: '.6s' }}>
          <span className="text-navy">Gene</span><span className="text-white">Meds</span>
        </h1>
        <p className="rise text-xl font-semibold text-navy" style={{ animationDelay: '.9s' }}>Pharmacogenomics-guided prescribing</p>
        <div className="mt-6 h-1 w-72 overflow-hidden rounded bg-white/40"><div className="load h-full bg-navy" style={{ animationDelay: '.3s' }} /></div>
        <button onClick={go} className="rounded-ctl px-3 py-1 text-sm font-semibold text-navy underline underline-offset-4">Skip</button>
      </div>
    </main>
  )
}