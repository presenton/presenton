import CustomTemplatePage from "./CustomTemplatePage";
import { redirect } from "next/navigation";
import { normalizePresentationGenerationMode } from "@/utils/presentationGenerationMode";

export const dynamic = "force-dynamic";

export default function Page() {
    if (
        normalizePresentationGenerationMode(
            process.env.PRESENTATION_GENERATION_MODE,
        ) === "smart"
    ) {
        redirect("/dashboard");
    }

    return <CustomTemplatePage />;
}
