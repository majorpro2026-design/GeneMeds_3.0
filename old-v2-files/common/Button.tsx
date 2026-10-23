import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'teal' | 'coral';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[34px]',
    md: 'text-sm px-4 py-2.5 gap-2 min-h-[42px]',
    lg: 'text-base px-6 py-3 gap-2.5 min-h-[48px]',
  }[size];

  const variantStyles = {
    primary:
      'bg-[#6D4AD8] hover:bg-[#5B3BC0] text-white shadow-sm hover:shadow focus-visible:outline-[#6D4AD8]',
    secondary:
      'bg-[#E9E3FB] hover:bg-[#D9CFF8] text-[#1E1B3A] dark:bg-[#2B2354] dark:text-[#E9E3FB] dark:hover:bg-[#382E6E] focus-visible:outline-[#6D4AD8]',
    outline:
      'border border-[#E4DFF5] dark:border-[#372F63] bg-transparent hover:bg-[#F4F1FD] dark:hover:bg-[#241F44] text-[#1F1B2E] dark:text-[#EDEAF7] focus-visible:outline-[#6D4AD8]',
    danger:
      'bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-sm hover:shadow focus-visible:outline-[#DC2626]',
    ghost:
      'bg-transparent hover:bg-[#F4F1FD] dark:hover:bg-[#241F44] text-[#6B6785] dark:text-[#A7A2C4] hover:text-[#1F1B2E] dark:hover:text-white',
    teal:
      'bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-sm hover:shadow focus-visible:outline-[#0D9488]',
    coral:
      'bg-[#E5683E] hover:bg-[#C8552D] text-white shadow-sm hover:shadow focus-visible:outline-[#E5683E]',
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
