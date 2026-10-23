import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, LogOut, Download, ShieldCheck } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useToast } from '../../context/ToastContext';

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const handleDownload = () => {
    toast.success('Pharmacogenomic Report PDF download initiated (Task 14/15 API).', 'PDF Download');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7]">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="md" direction="col" />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5683E]/10 text-xs font-bold text-[#E5683E]">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Patient Portal • Robert Langdon (GM-2026-000123)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={() => {
              toast.info('Signed out of Patient portal.');
              navigate('/');
            }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold font-['Manrope']">My Clinical PGx Report</h1>
            <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-1">
              Your personalized pharmacogenomic interaction summary authorized by Dr. Eleanor Vance.
            </p>
          </div>

          <Button
            variant="primary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            Download PDF Report
          </Button>
        </div>

        {/* Report Card (Screen S9 Placeholder) */}
        <Card className="p-6 sm:p-8 space-y-6">
          {/* Header of Report */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E4DFF5]/60 dark:border-[#372F63]/60">
            <div>
              <span className="text-[11px] font-bold text-[#6D4AD8] uppercase tracking-wider">
                Visit & Prescription Summary
              </span>
              <h2 className="text-xl font-bold mt-1 text-[#1E1B3A] dark:text-white">
                Comprehensive Genomic Drug Response Analysis
              </h2>
              <p className="text-xs text-[#6B6785] mt-1">
                Consultation Date: 19 October 2026 • Facility: Metropolitan Genomic Center
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">CPIC Guideline Verified</p>
                <p className="text-[10px]">Level 1A Drug-Gene Association</p>
              </div>
            </div>
          </div>

          {/* Doctor Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#F4F1FD] dark:bg-[#251F4A]/40 border border-[#E4DFF5] dark:border-[#372F63]">
              <span className="font-bold text-[#6B6785] uppercase tracking-wider text-[10px]">
                Attending Physician
              </span>
              <p className="font-bold text-sm text-[#1E1B3A] dark:text-white mt-1">
                Dr. Eleanor Vance, MD, PhD
              </p>
              <p className="text-[#6B6785] mt-0.5">Specialist in Clinical Pharmacogenomics</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F4F1FD] dark:bg-[#251F4A]/40 border border-[#E4DFF5] dark:border-[#372F63]">
              <span className="font-bold text-[#6B6785] uppercase tracking-wider text-[10px]">
                Prescribed Drug & Gene Target
              </span>
              <p className="font-bold text-sm text-[#1E1B3A] dark:text-white mt-1 flex items-center gap-2">
                <span>Clopidogrel (75mg)</span>
                <span className="px-2 py-0.5 rounded text-[11px] bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
                  CYP2C19
                </span>
              </p>
              <p className="text-[#6B6785] mt-0.5">Phenotype: Intermediate Metabolizer (*1/*2)</p>
            </div>
          </div>

          {/* Clinical Guidance Box */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <span>CPIC Recommendation Note</span>
            </p>
            <p className="leading-relaxed">
              Patient possesses loss-of-function allele *2 for CYP2C19 resulting in diminished antiplatelet response to Clopidogrel. Alternate antiplatelet therapy (e.g. Prasugrel or Ticagrelor) is strongly recommended per CPIC clinical guidelines.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};
