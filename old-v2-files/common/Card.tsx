import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }[padding];

  const variantStyles = {
    default:
      'bg-white dark:bg-[#1D1A38] border border-[#E4DFF5] dark:border-[#372F63] rounded-xl shadow-[0_2px_8px_-2px_rgba(109,74,216,0.08),0_1px_3px_rgba(31,27,46,0.04)]',
    elevated:
      'bg-white dark:bg-[#1D1A38] border border-[#E4DFF5]/60 dark:border-[#372F63] rounded-xl shadow-lg',
    bordered:
      'bg-white dark:bg-[#1D1A38] border-2 border-[#E4DFF5] dark:border-[#372F63] rounded-xl',
    interactive:
      'bg-white dark:bg-[#1D1A38] border border-[#E4DFF5] dark:border-[#372F63] rounded-xl shadow-[0_2px_8px_-2px_rgba(109,74,216,0.08)] hover:border-[#6D4AD8] hover:shadow-[0_8px_24px_-4px_rgba(109,74,216,0.18)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
  }[variant];

  return (
    <div className={`${variantStyles} ${paddingStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};
