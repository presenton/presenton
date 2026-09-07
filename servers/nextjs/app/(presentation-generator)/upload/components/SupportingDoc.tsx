"use client";

import type { ChangeEvent, DragEvent } from "react";
import { ArrowUp, File, Paperclip, X } from "lucide-react";

import { notify } from "@/components/ui/sonner";

interface SupportingDocProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
  multiple?: boolean;
}

const MAX_SUPPORTED_FILES = 8;
const ALLOWED_EXTENSIONS = [
  ".pdf", ".txt", ".doc", ".docx", ".docm", ".odt", ".rtf",
  ".ppt", ".pptx", ".pptm", ".odp", ".xls", ".xlsx", ".xlsm",
  ".ods", ".csv", ".tsv", ".jpg", ".jpeg", ".png", ".gif",
  ".bmp", ".tiff", ".webp",
];
const ACCEPT = ALLOWED_EXTENSIONS.join(",");

export default function SupportingDoc({
  files,
  onFilesChange,
  onSubmit,
  disabled = false,
  multiple = true,
}: SupportingDocProps) {
  const addFiles = (candidates: File[]) => {
    const allowed = candidates.filter(isAllowedFile);
    const rejected = candidates.length - allowed.length;
    if (rejected > 0) {
      notify.error(
        "Some files are not supported",
        "Supported: Word, PowerPoint, spreadsheets, PDF/TXT, and image files.",
      );
    }

    const next = multiple ? [...files, ...allowed] : allowed.slice(0, 1);
    const limited = next.slice(0, MAX_SUPPORTED_FILES);
    if (next.length > MAX_SUPPORTED_FILES) {
      notify.warning(
        "Maximum file limit reached",
        `You can upload up to ${MAX_SUPPORTED_FILES} documents only.`,
      );
    }
    if (limited.length > files.length) {
      notify.success(
        "Files selected",
        `${limited.length - files.length} file(s) have been added.`,
      );
    }
    onFilesChange(limited);
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <div
      className="flex flex-col gap-2.5 rounded-md"
      data-testid="attachments-uploader"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {files.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-2"
          data-testid="file-list"
          aria-label="Attached files"
        >
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="inline-flex h-[30px] max-w-full items-center gap-2 rounded-md border border-[#EDEEEF] bg-[#F6F6F9] px-2 font-manrope text-[11px] text-[#333333]"
              data-testid="attached-file-item"
            >
              <File className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
              <span className="max-w-[180px] truncate" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() =>
                  onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))
                }
                aria-label={`Remove ${file.name}`}
                data-testid="remove-file-button"
                className="rounded-full text-[#777777] hover:bg-[#E6E6E9] hover:text-[#191919]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full px-2.5 font-manrope text-xs font-medium text-[#4C4C4C] transition hover:bg-[#F6F6F9]">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{files.length ? `Attach more (${files.length})` : "Attach files"}</span>
          <input
            type="file"
            className="hidden"
            accept={ACCEPT}
            multiple={multiple}
            disabled={disabled}
            onChange={handleFilesSelected}
            data-testid="file-upload-input"
          />
        </label>

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          aria-label="Generate presentation"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function isAllowedFile(file: File) {
  const name = (file.name || "").toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}
