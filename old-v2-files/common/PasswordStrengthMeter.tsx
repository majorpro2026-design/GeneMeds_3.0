import React from 'react';
import { Check, Circle } from 'lucide-react';

export interface PasswordStrengthMeterProps {
  value: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ value }) => {
  const rules = [
    { label: '8+ characters', valid: value.length >= 8 },
    { label: 'A letter (a-z, A-Z)', valid: /[A-Za-z]/.test(value) },
    { label: 'A number (0-9)', valid: /\d/.test(value) },
    { label: 'A symbol (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(value) },
  ];

  const score = rules.filter((r) => r.valid).length;

  const barColors = ['bg-[#DC2626]', 'bg-[#D97706]', 'bg-[#D97706]', 'bg-[#16A34A]'];
  const activeColor = score > 0 ? barColors[score - 1] : 'bg-[#E4DFF5] dark:bg-[#372F63]';

  return (
    <div className="flex flex-col gap-2 mt-1">
      {/* 4 strength segments */}
      <div className="grid grid-cols-4 gap-1.5 w-full">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index < score ? activeColor : 'bg-[#E4DFF5] dark:bg-[#372F63]'
            }`}
          />
        ))}
      </div>

      {/* Checklist */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1 text-[11px] text-[#6B6785] dark:text-[#A7A2C4]">
        {rules.map((rule, idx) => (
          <li
            key={idx}
            className={`flex items-center gap-1.5 transition-colors ${
              rule.valid ? 'text-[#16A34A] dark:text-[#4ADE80] font-medium' : ''
            }`}
          >
            {rule.valid ? (
              <Check className="w-3.5 h-3.5 shrink-0 text-[#16A34A] dark:text-[#4ADE80]" />
            ) : (
              <Circle className="w-3 h-3 shrink-0 text-[#6B6785]/60" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
