import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  HeartHandshake,
  ChevronRight,
  Info,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { Splash } from '../components/Splash';

interface RoleDefinition {
  id: 'admin' | 'doctor' | 'receptionist' | 'patient';
  title: string;
  badge: string;
  description: string;
  accentColor: string;
  bgLight: string;
  icon: React.ReactNode;
}

export const ChooseRole: React.FC = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(false);

  const roles: RoleDefinition[] = [
    {
      id: 'admin',
      title: 'Admin',
      badge: 'System Admin',
      description:
        'Audit compliance logs, practitioner credentialing, security controls & integrations.',
      accentColor: '#475569',
      bgLight: 'rgba(71, 85, 105, 0.08)',
      icon: <ShieldCheck className="w-6 h-6 text-[#475569]" />,
    },
    {
      id: 'doctor',
      title: 'Doctor',
      badge: 'Prescriber & PGx',
      description:
        'Gene–drug interactions, diplotype risk matrices, PGx report authorization & electronic Rx.',
      accentColor: '#6D4AD8',
      bgLight: 'rgba(109, 74, 216, 0.08)',
      icon: <Stethoscope className="w-6 h-6 text-[#6D4AD8]" />,
    },
    {
      id: 'receptionist',
      title: 'Receptionist',
      badge: 'Patient Intake',
      description:
        'Patient check-in, PGx swab test scheduling, genetic sample tracking & lab uploads.',
      accentColor: '#0D9488',
      bgLight: 'rgba(13, 148, 136, 0.08)',
      icon: <ClipboardList className="w-6 h-6 text-[#0D9488]" />,
    },
    {
      id: 'patient',
      title: 'Patient',
      badge: 'Assisted Access',
      description:
        'Assisted diplotype review, genetic test status, medication alerts & consent forms.',
      accentColor: '#E5683E',
      bgLight: 'rgba(229, 104, 62, 0.08)',
      icon: <HeartHandshake className="w-6 h-6 text-[#E5683E]" />,
    },
  ];

  return (
    <>
      {showSplash && <Splash onComplete={() => setShowSplash(false)} />}

      <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7] transition-colors duration-200">
        {/* Top Header */}
        <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
          {/* Top-left: Logo with GeneMeds below */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            aria-label="GeneMeds Home"
          >
            <Logo size="md" direction="col" />
          </button>

          {/* Top-right Status Pills & Theme Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Clinical PGx Gateway v2.4</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>HIPAA Compliant • 256-Bit PGx</span>
            </div>

            <button
              onClick={() => setShowSplash(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E4DFF5] dark:border-[#372F63] text-xs font-medium text-[#6D4AD8] dark:text-[#B9A8F2] hover:bg-[#F4F1FD] dark:hover:bg-[#241F44] transition-all cursor-pointer"
              title="Replay introductory splash animation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Splash</span>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* LEFT COLUMN: Strictly uses gene_animation.mp4 */}
            <div className="lg:col-span-5 relative min-h-[380px] lg:min-h-[580px] rounded-3xl overflow-hidden bg-[#0B0620] border border-[#E4DFF5] dark:border-[#372F63] shadow-2xl flex flex-col justify-between p-6">
              {/* Background Video */}
              <video
                src="/gene_animation.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-90 filter contrast-105"
              />

              {/* Gradient Shading & Vignettes */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0620] via-transparent to-[#0B0620]/60 pointer-events-none" />

              {/* Top Floating Badge */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 text-white text-xs font-semibold tracking-wide shadow-lg">
                  <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                  Pharmacogenomic Intelligence
                </span>
              </div>

              {/* Floating DNA Markers (as seen in Stitch Preview) */}
              <div className="relative z-10 pointer-events-none flex flex-col gap-3 my-auto pl-2">
                <div className="self-start inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-violet-400/30 text-white text-[11px] font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-[#C026D3] animate-ping" />
                  <span>CYP2D6</span>
                </div>
                <div className="self-end inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-teal-400/30 text-white text-[11px] font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-ping" />
                  <span>CYP2C19</span>
                </div>
              </div>

              {/* Bottom PGx Info Glass Card */}
              <div className="relative z-10 p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">
                    CPIC Guideline Engine
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                    Active
                  </span>
                </div>
                <p className="text-xs text-white/90 mt-1 leading-relaxed">
                  Real-time gene-drug interaction detection, metabolizer phenotype classification &
                  prescribing precautions.
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: Choose Role Selection */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="max-w-xl w-full mx-auto lg:mx-0">
                {/* Header Tag */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E9E3FB] dark:bg-[#251F4A] text-[#6D4AD8] dark:text-[#B9A8F2] text-xs font-bold tracking-wide mb-3">
                  <span>Portal Authentication</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E1B3A] dark:text-[#EDEAF7] tracking-tight font-['Manrope']">
                  Choose your role
                </h1>

                <p className="mt-2 text-sm sm:text-base text-[#6B6785] dark:text-[#A7A2C4] leading-relaxed">
                  Select your healthcare practitioner role to access your dedicated clinical
                  console.
                </p>

                {/* Instruction Banner */}
                <div className="mt-5 p-3.5 rounded-xl bg-white dark:bg-[#181432] border border-[#E4DFF5] dark:border-[#372F63] flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 text-xs text-[#6B6785] dark:text-[#A7A2C4]">
                    <Info className="w-4 h-4 text-[#6D4AD8] shrink-0" />
                    <span>Click any role card below to open its dedicated sign in or registration page.</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F4F1FD] dark:bg-[#241F44] text-[#6D4AD8] dark:text-[#B9A8F2] shrink-0">
                    4 Clinical Roles
                  </span>
                </div>

                {/* Vertical Stack of 4 Role Cards */}
                <div className="mt-5 flex flex-col gap-3.5">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => navigate(`/auth/${role.id}`)}
                      className="group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1D1A38] border border-[#E4DFF5] dark:border-[#372F63] shadow-[0_2px_8px_-2px_rgba(109,74,216,0.08)] hover:shadow-[0_10px_28px_-6px_rgba(109,74,216,0.18)] hover:-translate-y-0.5 hover:border-[#6D4AD8] dark:hover:border-[#8B6CF0] transition-all duration-200 cursor-pointer text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AD8]"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Icon Container */}
                        <div
                          className="w-13 h-13 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: role.bgLight }}
                        >
                          {role.icon}
                        </div>

                        {/* Title & Description */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-[#1E1B3A] dark:text-[#EDEAF7] group-hover:text-[#6D4AD8] dark:group-hover:text-[#8B6CF0] transition-colors font-['Manrope']">
                              {role.title}
                            </h2>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F1FD] dark:bg-[#251F4A] text-[#6B6785] dark:text-[#A7A2C4] border border-[#E4DFF5] dark:border-[#372F63]">
                              {role.badge}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] line-clamp-1 mt-1 leading-relaxed">
                            {role.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Arrow */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6785] group-hover:text-[#6D4AD8] dark:group-hover:text-[#8B6CF0] group-hover:translate-x-1 group-hover:bg-[#F4F1FD] dark:group-hover:bg-[#251F4A] transition-all shrink-0 ml-3">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Fast Link to Component Library */}
                <div className="mt-6 pt-4 border-t border-[#E4DFF5]/60 dark:border-[#372F63]/60 flex items-center justify-between text-xs text-[#6B6785] dark:text-[#A7A2C4]">
                  <span>GeneMeds UI Component Library</span>
                  <button
                    onClick={() => navigate('/components')}
                    className="font-semibold text-[#6D4AD8] dark:text-[#B9A8F2] hover:underline cursor-pointer"
                  >
                    View Component Demo →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Global Footer */}
        <footer className="w-full px-6 py-4 border-t border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/40 dark:bg-[#181432]/40 backdrop-blur-xs text-xs text-[#6B6785] dark:text-[#A7A2C4] flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>GeneMeds Precision Clinical Platform © 2026 • Pharmacogenomics Clinical Decision Support</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <a href="#licensing" className="hover:text-[#6D4AD8] transition-colors">Practitioner Licensing</a>
            <span>•</span>
            <a href="#cpic" className="hover:text-[#6D4AD8] transition-colors">CPIC Guidelines</a>
            <span>•</span>
            <a href="#hipaa" className="hover:text-[#6D4AD8] transition-colors">HIPAA Security Standard</a>
            <span>•</span>
            <a href="#emergency" className="hover:text-[#6D4AD8] transition-colors">Emergency Protocol</a>
          </div>
        </footer>
      </div>
    </>
  );
};
