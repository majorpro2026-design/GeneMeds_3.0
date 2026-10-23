import React from 'react';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'splash';
  direction?: 'row' | 'col';
  variant?: 'default' | 'white' | 'splash';
  className?: string;
  showWordmark?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  direction = 'col',
  variant = 'default',
  className = '',
  showWordmark = true,
}) => {
  // Dimensions
  const dimensions = {
    sm: { icon: 32, text: 'text-xs', subtext: 'text-[9px]' },
    md: { icon: 44, text: 'text-base', subtext: 'text-[10px]' },
    lg: { icon: 56, text: 'text-xl', subtext: 'text-xs' },
    xl: { icon: 72, text: 'text-2xl', subtext: 'text-sm' },
    splash: { icon: 100, text: 'text-5xl sm:text-6xl', subtext: 'text-sm sm:text-base' },
  }[size];

  const isSplash = variant === 'splash';
  const isWhite = variant === 'white';

  return (
    <div
      className={`inline-flex items-center ${
        direction === 'col' ? 'flex-col justify-center text-center gap-1.5' : 'flex-row gap-3'
      } ${className}`}
    >
      {/* SVG Shield & Complimentary Duo-Tone DNA Mark */}
      <svg
        width={dimensions.icon}
        height={dimensions.icon * 1.15}
        viewBox="0 0 100 115"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-md transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Complimentary Gradient 1: Clinical Royal Violet to Vibrant Indigo */}
          <linearGradient id="shieldLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="60%" stopColor="#6D4AD8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>

          {/* Complimentary Gradient 2: Precision Medical Teal to Cyan */}
          <linearGradient id="shieldRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="50%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>

          {/* Core Shield Glow & Shadow */}
          <linearGradient id="shieldBgGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#2A1B54" />
            <stop offset="100%" stopColor="#130E29" />
          </linearGradient>

          {/* DNA Strand Gradient 1 (Violet-Magenta) */}
          <linearGradient id="dnaStrandViolet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D946EF" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>

          {/* DNA Strand Gradient 2 (Electric Teal-Mint) */}
          <linearGradient id="dnaStrandTeal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>

        {/* Outer Shield Container with Sleek Dual-Tone Accents */}
        <path
          d="M50 3L92 18V54C92 82 72 101 50 112C28 101 8 82 8 54V18L50 3Z"
          fill="url(#shieldBgGrad)"
          stroke="url(#shieldLeftGrad)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Right Shield complimentary glow trim */}
        <path
          d="M50 3L92 18V54C92 82 72 101 50 112"
          fill="none"
          stroke="url(#shieldRightGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Subtle Cross/Plus Medical Watermark in Shield Center */}
        <path
          d="M50 32V80M28 56H72"
          stroke="#FFFFFF"
          strokeOpacity="0.08"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* DNA Base Rungs (Horizontal Connectors) */}
        <g stroke="#E9E3FB" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round">
          <line x1="39" y1="36" x2="61" y2="36" />
          <line x1="34" y1="50" x2="66" y2="50" />
          <line x1="34" y1="64" x2="66" y2="64" />
          <line x1="39" y1="78" x2="61" y2="78" />
        </g>

        {/* Base Nodes */}
        <circle cx="39" cy="36" r="2.5" fill="#2DD4BF" />
        <circle cx="61" cy="36" r="2.5" fill="#C084FC" />
        <circle cx="34" cy="50" r="2.5" fill="#C084FC" />
        <circle cx="66" cy="50" r="2.5" fill="#2DD4BF" />
        <circle cx="34" cy="64" r="2.5" fill="#2DD4BF" />
        <circle cx="66" cy="64" r="2.5" fill="#C084FC" />
        <circle cx="39" cy="78" r="2.5" fill="#C084FC" />
        <circle cx="61" cy="78" r="2.5" fill="#2DD4BF" />

        {/* Strand 1 (Teal/Cyan Helix) */}
        <path
          d="M34 26C34 42 66 44 66 57C66 70 34 72 34 88"
          fill="none"
          stroke="url(#dnaStrandTeal)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* Strand 2 (Violet/Purple Helix) */}
        <path
          d="M66 26C66 42 34 44 34 57C34 70 66 72 66 88"
          fill="none"
          stroke="url(#dnaStrandViolet)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* Central Precision Spark / Core Accent */}
        <circle cx="50" cy="57" r="3" fill="#FFFFFF" />
      </svg>

      {/* Modern Wordmark */}
      {showWordmark && (
        <div className={`flex flex-col ${direction === 'col' ? 'items-center' : 'items-start'}`}>
          <div
            className={`font-['Plus_Jakarta_Sans',sans-serif] font-extrabold tracking-tight ${dimensions.text} leading-none`}
          >
            <span
              className={
                isSplash || isWhite
                  ? 'text-white'
                  : 'text-[#1E1B3A] dark:text-white transition-colors'
              }
            >
              Gene
            </span>
            <span
              className={
                isSplash
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-purple-300 to-teal-200'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-[#6D4AD8] to-[#0D9488]'
              }
            >
              Meds
            </span>
          </div>
          {isSplash && (
            <span
              className={`mt-2 font-['DM_Sans',sans-serif] font-medium tracking-widest uppercase text-violet-200/90 ${dimensions.subtext}`}
            >
              Precision Pharmacogenomics
            </span>
          )}
        </div>
      )}
    </div>
  );
};
