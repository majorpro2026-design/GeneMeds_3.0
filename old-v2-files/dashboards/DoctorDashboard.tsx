import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, LogOut, Search, UserCheck, FileText, Dna } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useToast } from '../../context/ToastContext';

export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const recentPatients = [
    {
      id: 'GM-2026-000123',
      name: 'Robert Langdon',
      age: 48,
      gender: 'Male',
      addedAt: '10 mins ago',
      isNew: true,
      condition: 'Cardiovascular / Hypertension',
    },
    {
      id: 'GM-2026-000122',
      name: 'Emma Watson',
      age: 34,
      gender: 'Female',
      addedAt: '2 hours ago',
      isNew: false,
      condition: 'Major Depressive Disorder',
    },
    {
      id: 'GM-2026-000119',
      name: 'James Wilson',
      age: 62,
      gender: 'Male',
      addedAt: 'Yesterday',
      isNew: false,
      condition: 'Post-PCI Clopidogrel Antiplatelet Therapy',
    },
  ];

  const filteredPatients = recentPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7]">
      {/* Doctor Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="md" direction="col" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9E3FB] dark:bg-[#251F4A] text-xs font-bold text-[#6D4AD8] dark:text-[#B9A8F2]">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Doctor Clinical Console • Dr. Eleanor Vance</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={() => {
              toast.info('Signed out of Doctor session.');
              navigate('/');
            }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold font-['Manrope']">Patient PGx Records</h1>
            <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-1">
              Select or search for a patient to open prescription authoring & CPIC gene test guidance.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <Input
              placeholder="Search by Patient Name or GM-ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Patients List */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-[#E4DFF5]/60 dark:border-[#372F63]/60 bg-[#F4F1FD]/40 dark:bg-[#251F4A]/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1E1B3A] dark:text-white uppercase tracking-wider">
              <UserCheck className="w-4 h-4 text-[#6D4AD8]" />
              <span>Recently Registered Intake Queue (Screen S6 Placeholder)</span>
            </div>
            <span className="text-xs text-[#6B6785]">{filteredPatients.length} patients</span>
          </div>

          <div className="divide-y divide-[#E4DFF5]/60 dark:divide-[#372F63]/60">
            {filteredPatients.map((p) => (
              <div
                key={p.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#6D4AD8]/10 text-[#6D4AD8] flex items-center justify-center font-bold text-sm shrink-0">
                    {p.name.charAt(0)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1E1B3A] dark:text-white">{p.name}</h3>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F4F1FD] dark:bg-[#251F4A] text-[#6D4AD8] dark:text-[#B9A8F2] border border-[#E4DFF5] dark:border-[#372F63]">
                        {p.id}
                      </span>
                      {p.isNew && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          NEW
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-1">
                      {p.gender}, {p.age} yrs • Indicative condition: {p.condition} • Added {p.addedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<FileText className="w-3.5 h-3.5" />}
                    onClick={() =>
                      toast.info(`Prescription Authoring for ${p.name} will be built in Task 10/11.`, 'Workflow')
                    }
                  >
                    Open Rx
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Dna className="w-3.5 h-3.5" />}
                    onClick={() =>
                      toast.success(`Gene Test Guidance for ${p.id} (CPIC algorithms ready in backend).`, 'PGx Support')
                    }
                  >
                    Gene Guidance
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
};
