import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'

export function Dashboard() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <main className="grid min-h-screen place-items-center p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h1 className="text-3xl font-bold">Welcome, {user?.fullName}</h1>
        <p className="text-muted">Signed in as {user?.role}. Your dashboard is built in a later task.</p>
        <Button variant="secondary" onClick={async () => { await logout(); nav('/roles') }}>Sign out</Button>
      </div>
    </main>
  )
}