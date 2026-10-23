import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, FileText, X } from 'lucide-react';

export interface FileDropzoneProps {
  label: string;
  isOptional?: boolean;
  isRequired?: boolean;
  accept?: string;
  maxSizeMB?: number;
  onFileSelect?: (file: File | null) => void;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  label,
  isOptional = false,
  accept = '.pdf,image/*',
  maxSizeMB = 5,
  onFileSelect,
  className = '',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (file && file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size exceeds ${maxSizeMB} MB limit.`);
      return;
    }
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label className="text-xs font-semibold text-[#1F1B2E] dark:text-[#EDEAF7] flex items-center justify-between">
        <span>
          {label} {isOptional && <span className="text-[#6B6785] font-normal">(optional)</span>}
          {!isOptional && <span className="text-[#DC2626] font-bold">*</span>}
        </span>
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[44px] rounded-lg border-1.5 border-dashed transition-all cursor-pointer ${
          isDragOver
            ? 'border-[#6D4AD8] bg-[#F4F1FD] dark:bg-[#251F4A]'
            : selectedFile
            ? 'border-[#16A34A]/50 bg-[#16A34A]/5'
            : 'border-[#B9A8F2] dark:border-[#372F63] bg-[#F4F1FD]/60 dark:bg-[#1D1A38]/50 hover:border-[#6D4AD8]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)}
        />

        <div className="flex items-center gap-2.5 min-w-0">
          {selectedFile ? (
            <FileText className="w-4 h-4 text-[#16A34A] shrink-0" />
          ) : (
            <UploadCloud className="w-4 h-4 text-[#6D4AD8] shrink-0" />
          )}

          <div className="min-w-0">
            <p className="text-xs text-[#1F1B2E] dark:text-[#EDEAF7] truncate font-medium">
              {selectedFile ? selectedFile.name : `Choose PDF or image (max ${maxSizeMB} MB)`}
            </p>
          </div>
        </div>

        {selectedFile ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-[#16A34A] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Attached
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1 text-[#6B6785] hover:text-[#DC2626]"
              aria-label="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-xs font-semibold text-[#6D4AD8] bg-white dark:bg-[#251F4A] px-2 py-0.5 rounded border border-[#E4DFF5] dark:border-[#372F63] shrink-0">
            Browse
          </span>
        )}
      </div>
    </div>
  );
};
