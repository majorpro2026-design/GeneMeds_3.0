import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Send,
  Lock,
  Mail,
  User,
  Layers,
} from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { FileDropzone } from '../components/common/FileDropzone';
import { PasswordStrengthMeter } from '../components/common/PasswordStrengthMeter';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { useToast } from '../context/ToastContext';

export const ComponentDemo: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [testPassword, setTestPassword] = useState('Pass123!');
  const [loadingButton, setLoadingButton] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7] transition-colors pb-16">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="md" direction="col" />
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B6785] hover:text-[#6D4AD8] dark:hover:text-[#B9A8F2] hover:bg-[#F4F1FD] dark:hover:bg-[#251F4A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal Home</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto p-6 sm:p-8 space-y-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E9E3FB] dark:bg-[#251F4A] text-[#6D4AD8] dark:text-[#B9A8F2] text-xs font-bold tracking-wide mb-2">
            <span>Design System & Architecture</span>
          </div>
          <h1 className="text-3xl font-extrabold font-['Manrope']">
            GeneMeds Task 4 Component Showcase
          </h1>
          <p className="text-sm text-[#6B6785] dark:text-[#A7A2C4] mt-1">
            Complete foundation demonstrating brand tokens, complimentary colors, responsive typography, and interactive components.
          </p>
        </div>

        {/* 1. Color Palette Tokens */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold font-['Manrope'] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#6D4AD8]" />
            <span>Design Tokens & Brand Palette</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {[
              { name: 'Primary Violet', hex: '#6D4AD8', text: 'text-white' },
              { name: 'Violet Hover', hex: '#5B3BC0', text: 'text-white' },
              { name: 'Lavender Light', hex: '#B9A8F2', text: 'text-[#1E1B3A]' },
              { name: 'Lavender Pale', hex: '#F4F1FD', text: 'text-[#1E1B3A]' },
              { name: 'Deep Navy', hex: '#1E1B3A', text: 'text-white' },
              { name: 'Medical Teal', hex: '#0D9488', text: 'text-white' },
              { name: 'Patient Coral', hex: '#E5683E', text: 'text-white' },
              { name: 'Admin Slate', hex: '#475569', text: 'text-white' },
              { name: 'Gene Magenta', hex: '#C026D3', text: 'text-white' },
              { name: 'Success Green', hex: '#16A34A', text: 'text-white' },
              { name: 'Warning Amber', hex: '#D97706', text: 'text-white' },
              { name: 'Error Red', hex: '#DC2626', text: 'text-white' },
            ].map((token) => (
              <div
                key={token.name}
                className="p-3 rounded-xl border border-[#E4DFF5] dark:border-[#372F63] bg-white dark:bg-[#1D1A38] shadow-xs flex flex-col gap-2"
              >
                <div
                  className={`w-full h-12 rounded-lg flex items-center justify-center font-mono text-xs font-bold ${token.text}`}
                  style={{ backgroundColor: token.hex }}
                >
                  {token.hex}
                </div>
                <div className="text-xs font-semibold truncate">{token.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Logo Displays */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold font-['Manrope'] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6D4AD8]" />
            <span>GeneMeds Logo Variations (Complimentary Duo-Tone)</span>
          </h2>

          <Card className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-items-center p-8">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#6B6785] font-semibold">Standard Column (Default)</span>
              <Logo size="md" direction="col" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#6B6785] font-semibold">Horizontal Row</span>
              <Logo size="md" direction="row" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-[#6B6785] font-semibold">Large Scale</span>
              <Logo size="lg" direction="col" />
            </div>
          </Card>
        </section>

        {/* 3. Button Component States */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold font-['Manrope']">Button Component Variants & States</h2>

          <Card className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Violet</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="teal">Receptionist Teal</Button>
              <Button variant="coral">Patient Coral</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#E4DFF5]/60 dark:border-[#372F63]/60">
              <Button size="sm">Small Size</Button>
              <Button size="md">Medium Size</Button>
              <Button size="lg">Large Size</Button>
              <Button
                variant="primary"
                isLoading={loadingButton}
                onClick={() => {
                  setLoadingButton(true);
                  setTimeout(() => setLoadingButton(false), 1500);
                }}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {loadingButton ? 'Loading...' : 'Click for Loading State'}
              </Button>
              <Button disabled variant="primary">
                Disabled State
              </Button>
            </div>
          </Card>
        </section>

        {/* 4. Input & Password Strength */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold font-['Manrope']">Form Inputs & Password Policy Validator</h2>

          <Card className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input
                label="Standard Text Input"
                placeholder="Enter patient full name"
                leftIcon={<User className="w-4 h-4" />}
                helperText="Used across intake registration forms"
              />

              <Input
                label="Email Input"
                type="email"
                placeholder="doctor@hospital.org"
                leftIcon={<Mail className="w-4 h-4" />}
                isRequired
              />

              <Input
                label="Error State Input"
                placeholder="Invalid value"
                error="Registration number already registered with state council."
                defaultValue="MCI-999999"
              />
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="Password with Strength Meter (Live Test)"
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />
                <PasswordStrengthMeter value={testPassword} />
              </div>

              <FileDropzone label="Document Upload Dropzone" isOptional />
            </div>
          </Card>
        </section>

        {/* 5. Toast Notifications & Modals */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold font-['Manrope']">Toasts & Modal Dialogs</h2>

          <Card className="flex flex-wrap items-center gap-4">
            <Button
              variant="outline"
              onClick={() => toast.success('Prescription verified and saved successfully!', 'Success')}
              leftIcon={<CheckCircle2 className="w-4 h-4 text-[#16A34A]" />}
            >
              Trigger Success Toast
            </Button>

            <Button
              variant="outline"
              onClick={() => toast.warning('Metabolizer phenotype requires alternate dosing.', 'Warning')}
              leftIcon={<AlertTriangle className="w-4 h-4 text-[#D97706]" />}
            >
              Trigger Warning Toast
            </Button>

            <Button
              variant="outline"
              onClick={() => toast.error('Account approval rejected by administrator.', 'Error')}
              leftIcon={<AlertCircle className="w-4 h-4 text-[#DC2626]" />}
            >
              Trigger Error Toast
            </Button>

            <Button
              variant="outline"
              onClick={() => toast.info('Connecting to Amazon Bedrock OCR service...', 'Information')}
              leftIcon={<Info className="w-4 h-4 text-[#0EA5E9]" />}
            >
              Trigger Info Toast
            </Button>

            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Open Accessible Modal
            </Button>
          </Card>
        </section>
      </main>

      {/* Demo Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Clinical Modal Confirmation"
        description="This modal demonstrates accessible overlay, keyboard ESC support, backdrop blur, and smooth animations."
      >
        <div className="space-y-4">
          <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4] leading-relaxed">
            All modals in GeneMeds follow the 12px/16px rounded surface guidelines with crisp micro-interactions and dark mode compatibility.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setModalOpen(false);
                toast.success('Action confirmed inside modal.');
              }}
            >
              Confirm Action
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
