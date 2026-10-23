import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, LogOut, Search, UserPlus, Users, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useToast } from '../../context/ToastContext';

export const ReceptionistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const patients = [
    {
      id: 'GM-2026-000123',
      name: 'Robert Langdon',
      dob: '1978-04-12',
      phone: '+1 (555) 349-2041',
      lastVisit: 'Today (Initial Visit)',
    },
    {
      id: 'GM-2026-000122',
      name: 'Emma Watson',
      dob: '1992-09-24',
      phone: '+1 (555) 782-9012',
      lastVisit: '3 days ago',
    },
    {
      id: 'GM-2026-000121',
      name: 'Arthur Pendelton',
      dob: '1965-11-03',
      phone: '+1 (555) 901-4432',
      lastVisit: '10 Oct 2026',
    },
  ];

  const results = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7]">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="md" direction="col" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D9488]/10 text-xs font-bold text-[#0D9488]">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Receptionist Desk Intake (Screen S3/S4 Placeholder)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={() => {
              toast.info('Signed out of Receptionist console.');
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
            <h1 className="text-2xl font-extrabold font-['Manrope']">Patient Registry & Intake</h1>
            <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-1">
              Search by name or GM-ID to log visits or register a first-time patient.
            </p>
          </div>

          <Button
            variant="teal"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() =>
              toast.info('Add New Patient form (Screen S5) will be built in Task 8.', 'Intake Flow')
            }
          >
            Add Patient
          </Button>
        </div>

        {/* Search Bar (Screen S3 layout) */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search patient by full name or ID (e.g. GM-2026-000123)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Search Results List */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-[#E4DFF5]/60 dark:border-[#372F63]/60 bg-[#F4F1FD]/40 dark:bg-[#251F4A]/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1E1B3A] dark:text-white uppercase tracking-wider">
              <Users className="w-4 h-4 text-[#0D9488]" />
              <span>Registered Patients Queue</span>
            </div>
            <span className="text-xs text-[#6B6785]">{results.length} found</span>
          </div>

          {results.length > 0 ? (
            <div className="divide-y divide-[#E4DFF5]/60 dark:divide-[#372F63]/60">
              {results.map((p) => (
                <div
                  key={p.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() =>
                    toast.info(`Opening details & second visit log for ${p.name}.`, 'Patient Intake')
                  }
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center font-bold text-sm shrink-0">
                      {p.name.charAt(0)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#1E1B3A] dark:text-white hover:text-[#0D9488] transition-colors">
                          {p.name}
                        </span>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F4F1FD] dark:bg-[#251F4A] text-[#0D9488] border border-[#0D9488]/20">
                          {p.id}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-1">
                        DOB: {p.dob} • Phone: {p.phone} • Last Visit: {p.lastVisit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View Details & Log Visit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-[#6B6785] dark:text-[#A7A2C4]">
              <Users className="w-10 h-10 mx-auto text-[#6B6785]/40 mb-3" />
              <p className="font-semibold text-sm">No patient found matching "{query}"</p>
              <p className="text-xs mt-1">Use the "Add Patient" button above to register a new file.</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};
