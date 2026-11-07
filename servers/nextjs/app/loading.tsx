import { PresentonSplashLoader } from "@/components/ui/presenton-splash-loader";
import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("loading");
  return <PresentonSplashLoader message={t("workspace")} />;
}
