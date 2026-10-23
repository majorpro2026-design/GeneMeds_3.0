import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/common/Button';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F7F5FF] dark:bg-[#0F0C20] text-[#1F1B2E] dark:text-[#EDEAF7] text-center">
      <div className="max-w-md w-full flex flex-col items-center animate-pop">
        <Logo size="lg" direction="col" className="mb-8" />

        <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h1 className="text-4xl font-extrabold font-['Manrope'] tracking-tight">404</h1>
        <h2 className="text-xl font-bold mt-2">Clinical Route Not Found</h2>
        <p className="text-xs sm:text-sm text-[#6B6785] dark:text-[#A7A2C4] mt-2 leading-relaxed">
          The requested page or resource could not be found or has been moved to another clinical path.
        </p>

        <div className="flex items-center gap-3 mt-6">
          <Button
            variant="outline"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>

          <Button
            variant="primary"
            leftIcon={<Home className="w-4 h-4" />}
            onClick={() => navigate('/')}
          >
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
};
