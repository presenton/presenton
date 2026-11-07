"use client";

import { useState } from "react";
import {
  CircleAlert,
  Loader2,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  "https://presenton.ai/download";

const formatLegacyDate = (value: string, locale: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(locale);
};

interface LegacyPresentationsTableProps {
  presentations: PresentationResponse[];
  onPresentationsDeleted: (presentationIds: string[]) => void;
}

export function LegacyPresentationsTable({
  presentations,
  onPresentationsDeleted,
}: LegacyPresentationsTableProps) {
  const t = useTranslations("dashboard.legacy");
  const tCard = useTranslations("dashboard.card");
  const locale = useLocale();
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
        t("deletedTitle"),
        t("deletedBody", { count: deletedIds.length })
      );
    }
    if (deletedIds.length !== presentations.length) {
      notify.error(
        t("deleteErrorTitle"),
        t("deleteErrorBody")
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
          {t("title")}
        </h2>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            aria-label={t("deleteAll")}
            title={t("deleteAll")}
            className="flex h-[35px] min-w-[51px] items-center justify-center rounded-full border border-[#EDEEEF] bg-white px-3 text-[#191919] transition-colors hover:bg-[#F6F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] disabled:cursor-not-allowed disabled:opacity-60"
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
          {t("notice")}{" "}
          <a
            href={LEGACY_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[#C4320A] underline decoration-[#C4320A] underline-offset-2"
          >
            {t("download")}
          </a>
          .
        </p>
      </div>

      <div className="w-full overflow-x-auto border-t border-[#EDEEEF]">
        <div className="min-w-[760px]">
          <div className="grid min-h-[56px] grid-cols-[minmax(280px,1fr)_272px_272px] border-b border-[#EDEEEF] text-sm font-semibold tracking-[0.14px] text-[#333333]">
            <div className="flex items-center px-[14px]">{t("name")}</div>
            <div className="flex items-center px-[14px]">{t("createdOn")}</div>
            <div className="flex items-center px-[14px]">{t("format")}</div>
          </div>
          {presentations.map((presentation) => (
            <div
              key={presentation.id}
              className="grid h-[50px] grid-cols-[minmax(280px,1fr)_272px_272px] border-b border-[#EDEEEF] text-sm text-[#333333]"
            >
              <div className="flex min-w-0 items-center px-4 font-syne font-medium">
                <span className="truncate">{presentation.title || tCard("untitled")}</span>
              </div>
              <div className="flex items-center px-4 font-medium">
                {formatLegacyDate(presentation.created_at, locale)}
              </div>
              <div className="flex items-center px-4">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#C4320A]">
                  <LockKeyhole className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                  {t("notAccessible")}
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
        <DialogContent
          hideDefaultClose
          overlayClassName="bg-black/40 backdrop-blur-[2px]"
          className="w-[calc(100vw-32px)] max-w-[400px] gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 font-syne shadow-xl sm:max-w-[400px]"
        >
          <DialogHeader className="items-start space-y-3 p-6 text-start sm:text-start">
            <DialogTitle
              id="delete-legacy-title"
              className="text-xl font-semibold leading-7 tracking-[-0.02em] text-neutral-900"
            >
              {t("deleteTitle")}
            </DialogTitle>
            <DialogDescription
              id="delete-legacy-description"
              className="text-sm leading-6 text-neutral-500"
            >
              {t("deleteBody", { count: presentations.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-3 px-6 pb-6 sm:grid sm:space-x-0">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-10 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void deleteLegacyPresentations()}
              disabled={isDeleting}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t("deleting")}
                </>
              ) : (
                t("delete")
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
