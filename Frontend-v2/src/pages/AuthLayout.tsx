import { useSyncExternalStore } from 'react'
import { Link, Outlet } from 'react-router'
import { Logo } from '../components/Logo'

const Q = '(min-width: 900px)'
function useWide() {
  return useSyncExternalStore(
    cb => { const m = matchMedia(Q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => matchMedia(Q).matches,
    () => true,
  )
}

export function AuthLayout() {
  const wide = useWide()
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="grid min-h-screen [--gap:8%] min-[1280px]:[--gap:25%] min-[900px]:grid-cols-[25%_var(--gap)_minmax(0,1fr)]">
      {wide && (
        <aside className="sticky top-0 h-screen overflow-hidden bg-[#0b0620]">
          <video src="/gene_animation.mp4" autoPlay={!reduce} muted loop playsInline preload="auto" aria-hidden className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0620]/80 via-transparent to-[#0b0620]/55" />
          <Link to="/roles" aria-label="GeneMeds home" className="absolute left-5 top-5"><Logo size={36} tone="dark" /></Link>
        </aside>
      )}
      <main className="flex min-h-screen min-w-0 flex-col items-center justify-center px-5 py-10 min-[900px]:col-start-3">
        {!wide && <div className="mb-8"><Logo size={44} /></div>}
        <Outlet />
      </main>
    </div>
  )
}