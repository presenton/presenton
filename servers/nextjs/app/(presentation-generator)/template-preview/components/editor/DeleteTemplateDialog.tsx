"use client";

import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteTemplateDialogProps = {
  isDeleting: boolean;
  open: boolean;
  templateName: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function DeleteTemplateDialog({
  isDeleting,
  open,
  templateName,
  onConfirm,
  onOpenChange,
}: DeleteTemplateDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isDeleting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent
        className="w-[calc(100vw-32px)] max-w-[432px] gap-0 rounded-[14px] border border-[#FEE4E2] bg-white p-0 shadow-[0_24px_64px_rgba(16,24,40,0.20)]"
      >
        <div className="p-6 pb-0">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEF3F2] text-[#D92D20]">
            <Trash2 className="h-5 w-5" />
          </div>

          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-[18px] font-semibold leading-[26px] tracking-normal text-[#101323]">
              Delete template?
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-[20px] text-[#667085]">
              This will permanently delete{" "}
              <span className="font-medium text-[#344054]">{templateName}</span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="mt-8 gap-3 border-t border-[#F2F4F7] bg-[#FCFCFD] px-6 py-4 sm:flex-row sm:justify-end sm:space-x-0">
          <button
            className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#D0D5DD] bg-white px-4 text-[14px] font-medium text-[#344054] shadow-sm transition-colors hover:bg-[#F9FAFB] disabled:pointer-events-none disabled:opacity-60"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#D92D20] bg-[#D92D20] px-4 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-[#B42318] disabled:pointer-events-none disabled:opacity-70"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isDeleting ? "Deleting" : "Delete Template"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
