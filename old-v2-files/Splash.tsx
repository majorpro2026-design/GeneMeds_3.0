import React, { useEffect, useState } from 'react';
import { Logo } from './common/Logo';

export interface SplashProps {
  onComplete: () => void;
  durationMs?: number;
}

export const Splash: React.FC<SplashProps> = ({ onComplete, durationMs = 3000 }) => {
  const [isFading, setIsFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (elapsed >= durationMs) {
        clearInterval(interval);
        setIsFading(true);
        setTimeout(onComplete, 600);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [durationMs, onComplete]);

  const handleSkip = () => {
    setIsFading(true);
    setTimeout(onComplete, 300);
  };

  return (
    <div
      role="status"
      aria-label="GeneMeds is loading"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#120D2C] via-[#1E1B3A] to-[#2B1B54] text-white transition-opacity duration-600 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient background glow orbs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[#6D4AD8]/20 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[350px] h-[350px] rounded-full bg-[#0D9488]/15 blur-[100px] -bottom-20 -right-20 pointer-events-none" />

      {/* Center Hero Block */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Animated Emblem */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 to-teal-500 blur-xl opacity-40 animate-pulse" />
          <div className="relative transform transition-transform hover:scale-105 duration-300">
            <Logo size="splash" direction="col" variant="splash" showWordmark={false} />
          </div>
        </div>

        {/* Wordmark with new complimentary colors and refined typography */}
        <div className="animate-rise">
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-5xl sm:text-6xl font-extrabold tracking-tight">
            <span className="text-white drop-shadow-md">Gene</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A78BFA] via-[#C084FC] to-[#2DD4BF] drop-shadow-sm">
              Meds
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base font-medium tracking-wide text-violet-200/90 font-['DM_Sans',sans-serif]">
            Precision Pharmacogenomics Clinical Decision Support
          </p>

          <p className="mt-1 text-xs text-violet-300/60 max-w-sm mx-auto">
            Diplotype-to-phenotype guidance & verified CPIC interaction safeguards
          </p>
        </div>

        {/* Clinical Security Pill */}
        <div className="mt-8 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-violet-200/80">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span>Clinical PGx Gateway v2.4</span>
          <span className="text-white/30">•</span>
          <span>HIPAA & CPIC Compliant</span>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 sm:w-64 flex flex-col items-center gap-2">
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#0D9488] transition-all duration-75 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          onClick={handleSkip}
          className="text-[11px] text-violet-300/50 hover:text-white transition-colors cursor-pointer mt-1"
        >
          Skip animation
        </button>
      </div>
    </div>
  );
};
