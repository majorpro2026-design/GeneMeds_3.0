import { Link } from 'react-router'
import { Logo } from '../components/Logo'

export function Placeholder({ title }: { title: string }) {
  return (
    <main className="grid min-h-screen place-items-center p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted">This screen is built in a later task.</p>
        <Link to="/demo" className="font-semibold text-violet underline underline-offset-4">Open component demo</Link>
      </div>
    </main>
  )
}