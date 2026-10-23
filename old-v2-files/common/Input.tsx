import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  isRequired?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightAction,
      isRequired = false,
      type = 'text',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const isPassword = type === 'password';
    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[#1F1B2E] dark:text-[#EDEAF7] flex items-center justify-between"
          >
            <span>
              {label} {isRequired && <span className="text-[#DC2626] font-bold">*</span>}
            </span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#6B6785] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={computedType}
            className={`w-full h-11 px-3.5 text-sm rounded-lg border bg-white dark:bg-[#1D1A38] text-[#1F1B2E] dark:text-[#EDEAF7] transition-all duration-150 placeholder:text-[#6B6785] dark:placeholder:text-[#6B6785]/80 focus:outline-none ${
              leftIcon ? 'pl-10' : ''
            } ${isPassword || rightAction ? 'pr-11' : ''} ${
              error
                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20'
                : 'border-[#E4DFF5] dark:border-[#372F63] focus:border-[#6D4AD8] focus:ring-2 focus:ring-[#6D4AD8]/20'
            } ${className}`}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 p-1 text-[#6B6785] hover:text-[#1F1B2E] dark:hover:text-white transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {!isPassword && rightAction && (
            <div className="absolute right-3 flex items-center">{rightAction}</div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-[#DC2626] font-medium mt-0.5">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#6B6785] mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
