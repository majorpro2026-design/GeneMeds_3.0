import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  HeartHandshake,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Phone,
  Building2,
  MapPin,
  GraduationCap,
  FileCheck,
  AlertCircle,
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

type RoleKey = 'admin' | 'doctor' | 'receptionist' | 'patient';

interface RoleConfig {
  name: string;
  badge: string;
  color: string;
  lightBg: string;
  icon: React.ReactNode;
  canRegister: boolean;
  adminNote?: string;
}

const ROLE_CONFIGS: Record<RoleKey, RoleConfig> = {
  admin: {
    name: 'Admin',
    badge: 'System Admin Console',
    color: '#475569',
    lightBg: 'rgba(71, 85, 105, 0.1)',
    icon: <ShieldCheck className="w-6 h-6 text-[#475569]" />,
    canRegister: false,
    adminNote: 'Admin accounts are created by the system owner and cannot be self-registered.',
  },
  doctor: {
    name: 'Doctor',
    badge: 'Prescriber & PGx Console',
    color: '#6D4AD8',
    lightBg: 'rgba(109, 74, 216, 0.1)',
    icon: <Stethoscope className="w-6 h-6 text-[#6D4AD8]" />,
    canRegister: true,
  },
  receptionist: {
    name: 'Receptionist',
    badge: 'Patient Intake Console',
    color: '#0D9488',
    lightBg: 'rgba(13, 148, 136, 0.1)',
    icon: <ClipboardList className="w-6 h-6 text-[#0D9488]" />,
    canRegister: true,
  },
  patient: {
    name: 'Patient',
    badge: 'Patient Portal',
    color: '#E5683E',
    lightBg: 'rgba(229, 104, 62, 0.1)',
    icon: <HeartHandshake className="w-6 h-6 text-[#E5683E]" />,
    canRegister: true,
  },
};

export const RoleAuth: React.FC = () => {
  const { role: routeRole } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const roleKey = (routeRole && routeRole in ROLE_CONFIGS ? routeRole : 'doctor') as RoleKey;
  const config = ROLE_CONFIGS[roleKey];

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // Sign In Form States
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Common Registration States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);

  // Doctor Specific States
  const [doctorRegId, setDoctorRegId] = useState('');
  const [degrees, setDegrees] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [regCertFile, setRegCertFile] = useState<File | null>(null);
  const [degreeFile, setDegreeFile] = useState<File | null>(null);

  // Receptionist Specific States
  const [receptionistDegree, setReceptionistDegree] = useState('');

  // Patient Specific States
  const [patientClinicId, setPatientClinicId] = useState('');

  // Error States
  const [formError, setFormError] = useState('');

  const validatePasswordRules = (pw: string) => {
    return (
      pw.length >= 8 &&
      /[A-Za-z]/.test(pw) &&
      /\d/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    );
  };

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!signInIdentifier.trim() || !signInPassword.trim()) {
      setFormError('Please enter both your email/user ID and password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success(`Signed in as ${config.name}! Opening dashboard...`, 'Authentication Success');
      navigate(`/${roleKey}/dashboard`);
    }, 800);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Common validations
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setFormError('Please fill in all mandatory personal details.');
      return;
    }

    // Role specific validations
    if (roleKey === 'doctor') {
      if (!doctorRegId.trim() || !degrees.trim() || !hospitalName.trim() || !hospitalAddress.trim()) {
        setFormError('Please fill in your doctor registration number, degrees, and hospital details.');
        return;
      }
      if (!degreeFile) {
        setFormError('Please upload your medical degree certificate.');
        return;
      }
      // regCertFile is optional; logged if provided
      if (regCertFile) {
        console.debug('Registration certificate attached:', regCertFile.name);
      }
    } else if (roleKey === 'receptionist') {
      if (!receptionistDegree.trim() || !hospitalName.trim() || !hospitalAddress.trim()) {
        setFormError('Please complete all hospital and educational fields.');
        return;
      }
    } else if (roleKey === 'patient') {
      if (!patientClinicId.trim()) {
        setFormError('Please enter your clinic-issued Patient ID.');
        return;
      }
    }

    // Password validation
    if (!validatePasswordRules(password)) {
      setFormError('Password does not satisfy the security policy (8+ chars, letter, number, symbol).');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('The two passwords do not match.');
      return;
    }

    if (!termsAgreed) {
      setFormError('You must agree to the Terms of Clinical Service and HIPAA Privacy Policy.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessModalOpen(true);
    }, 900);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7] transition-colors duration-200">
      {/* Top Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[#E4DFF5]/60 dark:border-[#302A54]/60 bg-white/60 dark:bg-[#181432]/60 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            aria-label="GeneMeds Home"
          >
            <Logo size="md" direction="col" />
          </button>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B6785] hover:text-[#6D4AD8] dark:hover:text-[#B9A8F2] hover:bg-[#F4F1FD] dark:hover:bg-[#251F4A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Choose a different role</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Video with active role preview */}
          <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-[620px] rounded-3xl overflow-hidden bg-[#0B0620] border border-[#E4DFF5] dark:border-[#372F63] shadow-2xl flex flex-col justify-between p-6">
            <video
              src="/gene_animation.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0620] via-transparent to-[#0B0620]/60 pointer-events-none" />

            {/* Role Chip Overlay */}
            <div className="relative z-10 flex items-center justify-between">
              <span
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-white text-xs font-semibold tracking-wide shadow-lg backdrop-blur-md border border-white/20"
                style={{ backgroundColor: `${config.color}CC` }}
              >
                {config.icon}
                {config.name} Console
              </span>
            </div>

            {/* Bottom Security Information */}
            <div className="relative z-10 p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-white shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-300 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Encrypted PGx Authorization</span>
              </div>
              <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                Role-based access security strictly enforces separation of concerns between
                prescribers, intake coordinators, and patients.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Auth Card & Forms */}
          <div className="lg:col-span-7">
            <Card className="w-full max-w-2xl mx-auto shadow-xl border-[#E4DFF5] dark:border-[#372F63] p-6 sm:p-8 rounded-3xl">
              {/* Header Title with Role Badge */}
              <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E4DFF5]/60 dark:border-[#372F63]/60">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: config.lightBg }}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold text-[#1E1B3A] dark:text-[#EDEAF7] font-['Manrope']">
                      {config.name}
                    </h1>
                    <p className="text-xs text-[#6B6785] dark:text-[#A7A2C4]">
                      {config.badge}
                    </p>
                  </div>
                </div>

                {/* Switch between Sign In / Create Account */}
                {config.canRegister && (
                  <div className="flex p-1 rounded-xl bg-[#F4F1FD] dark:bg-[#251F4A] border border-[#E4DFF5] dark:border-[#372F63]">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setFormError('');
                      }}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        mode === 'signin'
                          ? 'bg-white dark:bg-[#1D1A38] text-[#6D4AD8] dark:text-[#B9A8F2] shadow-xs'
                          : 'text-[#6B6785] dark:text-[#A7A2C4] hover:text-[#1F1B2E]'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setFormError('');
                      }}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        mode === 'signup'
                          ? 'bg-white dark:bg-[#1D1A38] text-[#6D4AD8] dark:text-[#B9A8F2] shadow-xs'
                          : 'text-[#6B6785] dark:text-[#A7A2C4] hover:text-[#1F1B2E]'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>
                )}
              </div>

              {/* Error Alert Box */}
              {formError && (
                <div className="mb-5 p-3 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* MODE 1: SIGN IN FORM */}
              {mode === 'signin' && (
                <form onSubmit={handleSignInSubmit} className="flex flex-col gap-4">
                  <Input
                    label="Email or User ID"
                    type="text"
                    isRequired
                    placeholder="Enter your registered email address"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    leftIcon={<Mail className="w-4 h-4" />}
                  />

                  <Input
                    label="Password"
                    type="password"
                    isRequired
                    placeholder="••••••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                  />

                  <div className="flex items-center justify-between text-xs mt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[#6B6785] dark:text-[#A7A2C4]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-[#E4DFF5] text-[#6D4AD8] focus:ring-[#6D4AD8]"
                      />
                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => toast.info('Password reset instructions will be provided in Task 18.', 'Forgot Password')}
                      className="text-xs font-medium text-[#6D4AD8] dark:text-[#B9A8F2] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    variant={roleKey === 'receptionist' ? 'teal' : roleKey === 'patient' ? 'coral' : 'primary'}
                    fullWidth
                    size="lg"
                    isLoading={isSubmitting}
                    className="mt-3"
                  >
                    Sign In as {config.name}
                  </Button>

                  {/* Note for Admin */}
                  {config.adminNote && (
                    <p className="mt-2 text-xs text-center text-[#6B6785] dark:text-[#A7A2C4] bg-[#F4F1FD] dark:bg-[#251F4A] p-2.5 rounded-lg border border-[#E4DFF5] dark:border-[#372F63]">
                      {config.adminNote}
                    </p>
                  )}

                  {/* Switch to Sign Up */}
                  {config.canRegister && (
                    <p className="text-center text-xs text-[#6B6785] dark:text-[#A7A2C4] mt-2">
                      New here?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setFormError('');
                        }}
                        className="font-bold text-[#6D4AD8] dark:text-[#B9A8F2] hover:underline cursor-pointer"
                      >
                        Create an account
                      </button>
                    </p>
                  )}
                </form>
              )}

              {/* MODE 2: CREATE ACCOUNT FORM */}
              {mode === 'signup' && config.canRegister && (
                <form onSubmit={handleSignUpSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Full name"
                      type="text"
                      isRequired
                      placeholder={roleKey === 'doctor' ? 'Dr. Eleanor Vance' : 'Full legal name'}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      leftIcon={<User className="w-4 h-4" />}
                    />

                    <Input
                      label="Email ID"
                      type="email"
                      isRequired
                      placeholder="you@hospital.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      leftIcon={<Mail className="w-4 h-4" />}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Phone number"
                      type="tel"
                      isRequired
                      placeholder="+1 (555) 782-9012"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      leftIcon={<Phone className="w-4 h-4" />}
                    />

                    {/* Role specific ID field */}
                    {roleKey === 'doctor' && (
                      <Input
                        label="Doctor registration ID"
                        type="text"
                        isRequired
                        placeholder="e.g. NPI-1948204910"
                        value={doctorRegId}
                        onChange={(e) => setDoctorRegId(e.target.value)}
                        leftIcon={<FileCheck className="w-4 h-4" />}
                      />
                    )}

                    {roleKey === 'receptionist' && (
                      <Input
                        label="Degree / Qualification"
                        type="text"
                        isRequired
                        placeholder="e.g. B.Sc. Healthcare Administration"
                        value={receptionistDegree}
                        onChange={(e) => setReceptionistDegree(e.target.value)}
                        leftIcon={<GraduationCap className="w-4 h-4" />}
                      />
                    )}

                    {roleKey === 'patient' && (
                      <Input
                        label="Patient ID"
                        type="text"
                        isRequired
                        placeholder="Given by your clinic (e.g. GM-2026-0001)"
                        value={patientClinicId}
                        onChange={(e) => setPatientClinicId(e.target.value)}
                        leftIcon={<HeartHandshake className="w-4 h-4" />}
                      />
                    )}
                  </div>

                  {/* Doctor specific educational & hospital fields */}
                  {roleKey === 'doctor' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Degrees"
                          type="text"
                          isRequired
                          placeholder="e.g. MD, PhD (Clinical Pharmacogenomics)"
                          value={degrees}
                          onChange={(e) => setDegrees(e.target.value)}
                          leftIcon={<GraduationCap className="w-4 h-4" />}
                        />
                        <FileDropzone
                          label="Upload degree (file upload)"
                          isRequired
                          onFileSelect={(f) => setDegreeFile(f)}
                        />
                      </div>

                      <FileDropzone
                        label="Certificate of registration"
                        isOptional
                        onFileSelect={(f) => setRegCertFile(f)}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Hospital (currently working)"
                          type="text"
                          isRequired
                          placeholder="Metropolitan Genomic Center"
                          value={hospitalName}
                          onChange={(e) => setHospitalName(e.target.value)}
                          leftIcon={<Building2 className="w-4 h-4" />}
                        />

                        <Input
                          label="Hospital address"
                          type="text"
                          isRequired
                          placeholder="742 Medical Research Pkwy, Suite 400"
                          value={hospitalAddress}
                          onChange={(e) => setHospitalAddress(e.target.value)}
                          leftIcon={<MapPin className="w-4 h-4" />}
                        />
                      </div>
                    </>
                  )}

                  {/* Receptionist specific hospital fields */}
                  {roleKey === 'receptionist' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Hospital name"
                        type="text"
                        isRequired
                        placeholder="Metropolitan Genomic Center"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        leftIcon={<Building2 className="w-4 h-4" />}
                      />

                      <Input
                        label="Hospital address"
                        type="text"
                        isRequired
                        placeholder="City, State, Zip"
                        value={hospitalAddress}
                        onChange={(e) => setHospitalAddress(e.target.value)}
                        leftIcon={<MapPin className="w-4 h-4" />}
                      />
                    </div>
                  )}

                  {/* Password & Confirmation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <Input
                        label="Create password"
                        type="password"
                        isRequired
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        leftIcon={<Lock className="w-4 h-4" />}
                      />
                      <PasswordStrengthMeter value={password} />
                    </div>

                    <Input
                      label="Confirm password"
                      type="password"
                      isRequired
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      leftIcon={<Lock className="w-4 h-4" />}
                    />
                  </div>

                  {/* Terms & Privacy checkbox */}
                  <label className="flex items-start gap-2.5 text-xs cursor-pointer text-[#6B6785] dark:text-[#A7A2C4] mt-2">
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="mt-0.5 rounded border-[#E4DFF5] text-[#6D4AD8] focus:ring-[#6D4AD8]"
                    />
                    <span>
                      I agree to the{' '}
                      <span className="text-[#6D4AD8] dark:text-[#B9A8F2] font-semibold underline">
                        Terms of Clinical Service
                      </span>{' '}
                      and{' '}
                      <span className="text-[#6D4AD8] dark:text-[#B9A8F2] font-semibold underline">
                        HIPAA Privacy Policy
                      </span>
                      .
                    </span>
                  </label>

                  {/* Review Notice */}
                  {roleKey !== 'patient' && (
                    <p className="text-[11px] text-[#6B6785] dark:text-[#A7A2C4] bg-[#F4F1FD] dark:bg-[#251F4A] p-2.5 rounded-lg border border-[#E4DFF5] dark:border-[#372F63]">
                      An administrator will review your medical credentials before account activation.
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant={roleKey === 'receptionist' ? 'teal' : roleKey === 'patient' ? 'coral' : 'primary'}
                    fullWidth
                    size="lg"
                    isLoading={isSubmitting}
                    className="mt-2"
                  >
                    Create Account as {config.name}
                  </Button>

                  <p className="text-center text-xs text-[#6B6785] dark:text-[#A7A2C4]">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setFormError('');
                      }}
                      className="font-bold text-[#6D4AD8] dark:text-[#B9A8F2] hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                </form>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        maxWidth="sm"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 animate-pop">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold font-['Manrope'] text-[#1E1B3A] dark:text-[#EDEAF7]">
            Account Created Successfully
          </h3>

          <p className="text-xs sm:text-sm text-[#6B6785] dark:text-[#A7A2C4] mt-2 leading-relaxed">
            {roleKey === 'patient'
              ? 'Your patient account is ready. You can sign in now using your credentials.'
              : 'An admin will review your healthcare credentials. You will be able to sign in once your account is approved.'}
          </p>

          <Button
            onClick={() => {
              setSuccessModalOpen(false);
              setMode('signin');
              toast.success('Registration submitted for approval.');
            }}
            fullWidth
            variant="primary"
            className="mt-6"
          >
            Continue to Sign In
          </Button>
        </div>
      </Modal>
    </div>
  );
};
