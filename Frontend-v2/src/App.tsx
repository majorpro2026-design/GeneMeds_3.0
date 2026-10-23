import { Route, Routes } from 'react-router'
import { RequireRole } from './auth/RequireRole'
import { AuthLayout } from './pages/AuthLayout'
import { AuthPage } from './pages/AuthPage'
import { Dashboard } from './pages/Dashboard'
import { Demo } from './pages/Demo'
import { Placeholder } from './pages/Placeholder'
import { Roles } from './pages/Roles'
import { Splash } from './pages/Splash'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AuditTab } from './pages/admin/AuditTab'
import { UsersTab } from './pages/admin/UsersTab'
import { ReceptionPage } from './pages/reception/ReceptionPage'
import { DoctorPage } from './pages/doctor/DoctorPage'
import { VisitPage } from './pages/doctor/VisitPage'

const home = (role: string) => <RequireRole role={role}><Dashboard /></RequireRole>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route element={<AuthLayout />}>
        <Route path="/roles" element={<Roles />} />
        <Route path="/auth/:role" element={<AuthPage />} />
      </Route>
      <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
      <Route index element={<UsersTab />} />
      <Route path="audit" element={<AuditTab />} />
      </Route>
      <Route path="/doctor" element={<RequireRole role="doctor"><DoctorPage /></RequireRole>} />
      <Route path="/doctor/visit/:id" element={<RequireRole role="doctor"><VisitPage /></RequireRole>} />
      <Route path="/receptionist" element={<RequireRole role="receptionist"><ReceptionPage /></RequireRole>} />
      <Route path="/patient" element={home('patient')} />
      <Route path="/demo" element={<Demo />} />
      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  )
}