import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, Check, XCircle, Clock } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useToast } from '../../context/ToastContext';

interface MockUser {
  id: number;
  name: string;
  email: string;
  role: 'doctor' | 'receptionist';
  hospital: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [users, setUsers] = useState<MockUser[]>([
    {
      id: 1,
      name: 'Dr. Jane Doe',
      email: 'doctor@hospital.org',
      role: 'doctor',
      hospital: 'Metro City Hospital',
      status: 'pending',
    },
    {
      id: 2,
      name: 'Sarah Connor',
      email: 'sarah.c@genomics.org',
      role: 'receptionist',
      hospital: 'Apex Clinical Care',
      status: 'pending',
    },
    {
      id: 3,
      name: 'Dr. Marcus Vance',
      email: 'marcus.vance@pgx.net',
      role: 'doctor',
      hospital: 'St. Jude Genomic Health',
      status: 'active',
    },
  ]);

  const updateStatus = (id: number, newStatus: MockUser['status']) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u))
    );
    toast.success(`User #${id} status updated to ${newStatus}.`, 'Admin Action');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7]">
      {/* Admin Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="md" direction="col" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Admin Management Console (Task 4 Placeholder)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={() => {
              toast.info('Signed out of Admin session.');
              navigate('/');
            }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold font-['Manrope']">Practitioner Approvals</h1>
            <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-1">
              Verify credentials and approve doctor & receptionist registrations (Screen S10).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{users.filter((u) => u.status === 'pending').length} Pending Reviews</span>
            </span>
          </div>
        </div>

        {/* User Table Card */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F1FD] dark:bg-[#251F4A] border-b border-[#E4DFF5] dark:border-[#372F63] text-[#6B6785] dark:text-[#A7A2C4] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Practitioner</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Hospital</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFF5]/60 dark:divide-[#372F63]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#1E1B3A] dark:text-white">{u.name}</div>
                      <div className="text-[11px] text-[#6B6785]">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize font-semibold text-[#6D4AD8] dark:text-[#B9A8F2]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B6785] dark:text-[#A7A2C4]">
                      {u.hospital}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : u.status === 'pending'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => updateStatus(u.id, 'active')}
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(u.id, 'rejected')}
                              leftIcon={<XCircle className="w-3.5 h-3.5" />}
                            >
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatus(u.id, u.status === 'active' ? 'suspended' : 'active')
                            }
                          >
                            {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
};
