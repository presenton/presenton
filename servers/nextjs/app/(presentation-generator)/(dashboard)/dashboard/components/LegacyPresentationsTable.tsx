"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  Loader2,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { notify } from "@/components/ui/sonner";
import {
  DashboardApi,
  type PresentationResponse,
} from "@/app/(presentation-generator)/services/api/dashboard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LEGACY_RELEASE_URL =
  "https://github.com/presenton/presenton/releases";

const formatLegacyDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

interface LegacyPresentationsTableProps {
  presentations: PresentationResponse[];
  onPresentationsDeleted: (presentationIds: string[]) => void;
}

export function LegacyPresentationsTable({
  presentations,
  onPresentationsDeleted,
}: LegacyPresentationsTableProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (presentations.length === 0) return null;

  const deleteLegacyPresentations = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    const results = await Promise.all(
      presentations.map(async (presentation) => ({
        id: presentation.id,
        response: await DashboardApi.deletePresentation(presentation.id),
      }))
    );
    const deletedIds = results
      .filter(({ response }) => response?.success)
      .map(({ id }) => id);

    if (deletedIds.length > 0) {
      onPresentationsDeleted(deletedIds);
      notify.success(
        "Legacy presentations deleted",
        `${deletedIds.length} presentation${deletedIds.length === 1 ? " was" : "s were"} removed.`
      );
    }
    if (deletedIds.length !== presentations.length) {
      notify.error(
        "Some presentations could not be deleted",
        "Please try again."
      );
    }
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  return (
    <section className="w-full" aria-labelledby="legacy-presentations-heading">
      <div className="mb-[14px] flex min-h-[35px] items-center justify-between gap-4">
        <h2
          id="legacy-presentations-heading"
          className="font-syne text-base font-medium text-[#191919]"
        >
          Legacy Presentation
        </h2>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            aria-label="Delete all legacy presentations"
            title="Delete all legacy presentations"
            className="flex h-[35px] min-w-[51px] items-center justify-center rounded-full border border-[#EDEEEF] bg-white px-3 text-[#191919] transition-colors hover:bg-[#F6F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="mb-[14px] flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#FFFAF4] px-[14px] py-2.5 text-[13px] font-medium leading-[14px] tracking-[0.13px]">
        <CircleAlert
          className="h-[18px] w-[18px] shrink-0 fill-[#C4320A] text-white"
          strokeWidth={2}
          aria-hidden="true"
        />
        <p className="text-[#4C4C4C]">
          These presentations were created in an older format and can&apos;t be
          opened in the current version. {" "}
          <a
            href={LEGACY_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[#C4320A] underline decoration-[#C4320A] underline-offset-2"
          >
            Download an older release to access them
          </a>
          .
        </p>
      </div>

      <div className="w-full overflow-x-auto border-t border-[#EDEEEF]">
        <div className="min-w-[760px]">
          <div className="grid min-h-[56px] grid-cols-[minmax(280px,1fr)_272px_272px] border-b border-[#EDEEEF] text-sm font-semibold tracking-[0.14px] text-[#333333]">
            <div className="flex items-center px-[14px]">Name</div>
            <div className="flex items-center px-[14px]">Created on</div>
            <div className="flex items-center px-[14px]">Format</div>
          </div>
          {presentations.map((presentation) => (
            <div
              key={presentation.id}
              className="grid h-[50px] grid-cols-[minmax(280px,1fr)_272px_272px] border-b border-[#EDEEEF] text-sm text-[#333333]"
            >
              <div className="flex min-w-0 items-center px-4 font-syne font-medium">
                <span className="truncate">{presentation.title || "Untitled presentation"}</span>
              </div>
              <div className="flex items-center px-4 font-medium">
                {formatLegacyDate(presentation.created_at)}
              </div>
              <div className="flex items-center px-4">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#C4320A]">
                  <LockKeyhole className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                  Not Accessible
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (isDeleting && !open) return;
          setShowDeleteDialog(open);
        }}
      >
        <DialogContent className="w-full max-w-[392px] rounded-[24px] border-0 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:max-w-[392px] [&>button]:hidden">
          <DialogHeader className="items-center px-7 pb-5 pt-7 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1F0]">
              <AlertTriangle
                className="h-6 w-6 text-[#F04438]"
                aria-hidden="true"
              />
            </div>
            <DialogTitle
              id="delete-legacy-title"
              className="font-syne text-[24px] font-medium leading-[30px] tracking-[-0.02em] text-[#191919]"
            >
              Delete legacy presentations?
            </DialogTitle>
            <DialogDescription
              id="delete-legacy-description"
              className="max-w-[296px] pt-1 text-[15px] leading-6 text-[#667085]"
            >
              This will permanently delete all {presentations.length} legacy
              presentation{presentations.length === 1 ? "" : "s"}. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row border-t border-[#EAECF0] p-0 sm:space-x-0">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-[56px] flex-1 rounded-none rounded-bl-[24px] px-4 text-sm font-medium text-[#344054] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void deleteLegacyPresentations()}
              disabled={isDeleting}
              className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-none rounded-br-[24px] border-l border-[#EAECF0] px-4 text-sm font-medium text-[#F04438] transition-colors hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
