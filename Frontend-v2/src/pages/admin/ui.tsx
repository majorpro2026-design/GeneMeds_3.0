import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/Button'
import { ApiError } from '../../lib/api'
import { PAGE_SIZE } from '../../lib/adminApi'

export function Pager({ total, offset, onChange }: { total: number; offset: number; onChange: (o: number) => void }) {
  const from = total ? offset + 1 : 0
  const to = Math.min(offset + PAGE_SIZE, total)
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>{from}–{to} of {total}</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
        <Button variant="secondary" disabled={offset + PAGE_SIZE >= total} onClick={() => onChange(offset + PAGE_SIZE)}>Next</Button>
      </div>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { logout } = useAuth()
  const nav = useNavigate()
  const expired = error instanceof ApiError && error.status === 401
  const msg = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-err/30 bg-err/10 px-4 py-3 text-sm text-err">
      <span>{expired ? 'Your session expired. Please sign in again.' : msg}</span>
      {expired
        ? <Button variant="secondary" onClick={async () => { await logout(); nav('/roles') }}>Sign in again</Button>
        : <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  )
}