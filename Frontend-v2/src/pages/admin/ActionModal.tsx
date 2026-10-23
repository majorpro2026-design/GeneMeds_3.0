import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { ACTION_META, decide, profileRows, type Action, type AdminUser } from '../../lib/adminApi'

export function ActionModal({ user, action, onClose }: { user: AdminUser; action: Action; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const meta = ACTION_META[action]
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const m = useMutation({
    mutationFn: () => decide(user.id, action, reason.trim()),
    onSuccess: () => {
      toast(`${user.fullName} ${meta.past}.`, 'success')
      void qc.invalidateQueries({ queryKey: ['admin'] })
      onClose()
    },
    onError: e => {
      setError(e instanceof Error ? e.message : 'Action failed.')
      void qc.invalidateQueries({ queryKey: ['admin'] }) // the account may have changed, refresh the list
    },
  })

  function submit() {
    if (meta.needsReason && reason.trim().length < 5) { setError('Enter a reason of at least 5 characters.'); return }
    setError('')
    m.mutate()
  }

  return (
    <Modal open onClose={onClose} title={`${meta.label} ${user.fullName}?`}>
      <p className="mb-3 text-sm text-muted">{meta.hint}</p>
      <dl className="mb-4 grid gap-1 rounded-ctl border border-line bg-lav-pale p-3 text-sm">
        <div><dt className="inline text-muted">Email: </dt><dd className="inline break-all">{user.email}</dd></div>
        {profileRows(user).map(([k, v]) => (
          <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline">{v || '—'}</dd></div>
        ))}
      </dl>
      <label htmlFor="reason" className="mb-1.5 block text-[13px] font-semibold">
        Reason {meta.needsReason ? <b className="text-err">*</b> : <span className="font-normal text-muted">(optional)</span>}
      </label>
      <textarea id="reason" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
        className="w-full rounded-ctl border border-line p-3 text-sm focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15" />
      {error && <p role="alert" className="mt-2 text-sm text-err">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={meta.variant} loading={m.isPending} onClick={submit}>{meta.label}</Button>
      </div>
    </Modal>
  )
}