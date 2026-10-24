import { useSyncExternalStore } from 'react'
import { Link, Outlet } from 'react-router'
import { Logo } from '../components/Logo'

const Q = '(min-width: 900px)'
function useWide() {
  return useSyncExternalStore(
    cb => {
      const m = matchMedia(Q)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia(Q).matches,
    () => true,
  )
}

export function AuthLayout() {
  const wide = useWide()
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="grid min-h-[100dvh] w-full min-[900px]:grid-cols-2 bg-canvas">
      {wide && (
        <aside className="relative sticky top-0 h-[100dvh] w-full overflow-hidden bg-[#0a051d]">
          {/* DNA helix video occupying 50% screen width and 100dvh height */}
          <video
            src="/gene_animation.mp4"
            autoPlay={!reduce}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
            className="absolute inset-0 size-full object-cover object-center"
          />

          {/* Subtle dark-purple biotechnology gradient overlays for depth and visual contrast */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a051d]/90 via-[#0d0726]/40 to-[#0a051d]/75" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(109,74,216,0.18)_0%,transparent_75%)]" />

          {/* GeneMeds minimal DNA branding in the upper-left corner */}
          <Link
            to="/roles"
            aria-label="GeneMeds home"
            className="group absolute left-8 top-8 z-10 inline-flex items-center rounded-ctl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lav focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a051d]"
          >
            <Logo size={34} tone="dark" />
          </Link>
        </aside>
      )}

      {/* Right panel: 50% viewport width, role selection centered horizontally and vertically */}
      <main className="flex min-h-[100dvh] w-full min-w-0 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        {!wide && (
          <div className="mb-8">
            <Link to="/roles" aria-label="GeneMeds home">
              <Logo size={40} tone="light" />
            </Link>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}