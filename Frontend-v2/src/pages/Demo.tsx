import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Logo } from '../components/Logo'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

export function Demo() {
  const [open, setOpen] = useState(false)
  const toast = useToast()
  return (
    <main className="mx-auto grid max-w-4xl gap-6 p-8">
      <h1 className="text-3xl font-bold">Component demo</h1>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Logo</h2>
        <div className="flex flex-wrap gap-6">
          <div className="rounded-card bg-white p-6"><Logo /></div>
          <div className="rounded-card bg-[#9479E6] p-6"><Logo tone="splash" size={64} /></div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="teal">Receptionist</Button>
          <Button variant="coral">Patient</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Inputs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" placeholder="you@example.com" required />
          <Input label="With hint" hint="We never share this." />
          <Input label="With error" error="This field is required." defaultValue="bad" />
          <Input label="Disabled" disabled defaultValue="Locked" />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Modal and toast</h2>
        <div className="flex gap-3">
          <Button onClick={() => setOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => toast('Saved successfully', 'success')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast('Something went wrong', 'error')}>Error toast</Button>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Account created">
        <p className="mb-5 text-muted">Modal built on the native dialog element.</p>
        <Button className="w-full" onClick={() => setOpen(false)}>Done</Button>
      </Modal>
    </main>
  )
}