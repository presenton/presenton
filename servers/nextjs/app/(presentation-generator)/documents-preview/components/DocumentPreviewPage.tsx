/**
 * DocumentPreviewPage Component
 *
 * A component that displays and manages document previews for presentation generation.
 * Features:
 * - Document content preview with markdown support
 * - Sidebar navigation for documents
 * - Document content editing and saving
 * - Presentation generation workflow
 *
 * @component
 */

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { setPresentationId } from "@/store/slices/presentationGeneration";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getIconFromFile } from "../../utils/others";
import { ChevronRight, PanelRightOpen, X } from "lucide-react";
import ToolTip from "@/components/ToolTip";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

// Types
interface LoadingState {
  message: string;
  show: boolean;
  duration: number;
  progress: boolean;
}

interface TextContents {
  [key: string]: string;
}

interface FileItem {
  name: string;
  file_path: string;
}

const DocumentsPreviewPage: React.FC = () => {
  // Hooks
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redux state
  const { config, files } = useSelector(
    (state: RootState) => state.pptGenUpload
  );

  // Local state
  const [textContents, setTextContents] = useState<TextContents>({});
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [downloadingDocuments, setDownloadingDocuments] = useState<string[]>(
    []
  );
  const [isOpen, setIsOpen] = useState(true);
  const [showLoading, setShowLoading] = useState<LoadingState>({
    message: "",
    show: false,
    duration: 10,
    progress: false,
  });

  // Memoized computed values
  const fileItems: FileItem[] = useMemo(() => {
    if (!files || !Array.isArray(files) || files.length === 0) return [];
    return files
      .flat()
      .filter((item: any) => item && item.name && item.file_path);
  }, [files]);

  const documentKeys = useMemo(() => {
    return fileItems.map((file) => file.name);
  }, [fileItems]);

  const updateSelectedDocument = (value: string) => {
    setSelectedDocument(value);
    if (textareaRef.current) {
      textareaRef.current.value = textContents[value] || "";
    }
  };

  const readFile = async (filePath: string) => {
    const res = await fetch(`/api/read-file`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
    return res.json();
  };

  const maintainDocumentTexts = async () => {
    const newDocuments: string[] = [];
    const promises: Promise<{ content: string }>[] = [];

    // Process documents
    documentKeys.forEach((key: string) => {
      if (!(key in textContents)) {
        newDocuments.push(key);
        const fileItem = fileItems.find((item) => item.name === key);
        if (fileItem) {
          promises.push(readFile(fileItem.file_path));
        }
      }
    });

    if (promises.length > 0) {
      setDownloadingDocuments(newDocuments);
      try {
        const results = await Promise.all(promises);
        setTextContents((prev) => {
          const newContents = { ...prev };
          newDocuments.forEach((key, index) => {
            newContents[key] = results[index].content || "";
          });
          return newContents;
        });
      } catch (error) {
        console.error("Error reading files:", error);
        toast.error("Failed to read document content");
      }
      setDownloadingDocuments([]);
    }
  };

  const handleCreatePresentation = async () => {
    try {
      setShowLoading({
        message: "Generating presentation outline...",
        show: true,
        duration: 40,
        progress: true,
      });

      const documentPaths = fileItems.map(
        (fileItem: FileItem) => fileItem.file_path
      );
      trackEvent(MixpanelEvent.DocumentsPreview_Create_Presentation_API_Call);
      const createResponse = await PresentationGenerationApi.createPresentation(
        {
          content: config?.prompt ?? "",
          n_slides: config?.slides ? parseInt(config.slides) : null,
          file_paths: documentPaths,
          language: config?.language ?? "",
          tone: config?.tone,
          verbosity: config?.verbosity,
          instructions: config?.instructions || null,
          include_table_of_contents: !!config?.includeTableOfContents,
          include_title_slide: !!config?.includeTitleSlide,
          web_search: !!config?.webSearch,
        }
      );

      dispatch(setPresentationId(createResponse.id));
      trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/outline" });
      router.replace("/outline");
    } catch (error: any) {
      console.error("Error in radar presentation creation:", error);
      toast.error("Error", {
        description: error.message || "Error in radar presentation creation.",
      });
      setShowLoading({
        message: "Error in radar presentation creation.",
        show: true,
        duration: 10,
        progress: false,
      });
    } finally {
      setShowLoading({
        message: "",
        show: false,
        duration: 10,
        progress: false,
      });
    }
  };

  // Effects
  useEffect(() => {
    if (documentKeys.length > 0) {
      setSelectedDocument(documentKeys[0]);
      maintainDocumentTexts();
    }
  }, [documentKeys]);

  // Render helpers
  const renderDocumentContent = () => {
    if (!selectedDocument) return null;

    const isDocument = documentKeys.includes(selectedDocument);

    if (!isDocument) return null;

    return (
      <div className="h-full mr-4">
        <div className="overflow-y-auto custom_scrollbar h-full">
          <div className="h-full w-full max-w-full flex flex-col mb-5">
            <h1 className="text-2xl font-medium mb-5">Content:</h1>
            {downloadingDocuments.includes(selectedDocument) ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-[#2E2E2E]">
                {textContents[selectedDocument] || ""}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    if (!isOpen) return null;

    return (
      <div className={`border-r border-gray-200 fixed xl:relative w-full z-50 xl:z-auto
        transition-all duration-300 bg-white ease-in-out max-w-[200px] md:max-w-[300px] h-[85vh] rounded-md p-5`}>
        <X
          onClick={() => setIsOpen(false)}
          className="text-black mb-4 ml-auto mr-0 cursor-pointer hover:text-gray-600"
          size={20}
        />

        {documentKeys.length > 0 && (
          <div className="mt-8">
            <p className="text-xs mt-2 text-[#2E2E2E] opacity-70">DOCUMENTS</p>
            <div className="flex flex-col gap-2 mt-6">
              {documentKeys.map((key: string) => (
                <div
                  key={key}
                  onClick={() => updateSelectedDocument(key)}
                  className={`${selectedDocument === key ? "border border-blue-500" : ""
                    } flex p-2 rounded-sm gap-2 items-center cursor-pointer`}
                >
                  <img
                    className="h-6 w-6 border border-gray-200"
                    src={getIconFromFile(key)}
                    alt="Document icon"
                  />
                  <span className="text-sm h-6 text-[#2E2E2E] overflow-hidden">
                    {key.split("/").pop() ?? "file.txt"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white/90 min-h-screen flex flex-col w-full`}>
      <OverlayLoader
        show={showLoading.show}
        text={showLoading.message}
        showProgress={showLoading.progress}
        duration={showLoading.duration}
      />
      <Header />
      <div className="flex mt-6 gap-4 font-instrument_sans">
        {!isOpen && (
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
            <ToolTip content="Open Panel">
              <Button
                onClick={() => setIsOpen(true)}
                className="bg-[#5146E5] text-white p-3 shadow-lg"
              >
                <PanelRightOpen className="text-white" size={20} />
              </Button>
            </ToolTip>
          </div>
        )}

        {renderSidebar()}

        <div className="bg-white w-full mx-2 sm:mx-4 h-[calc(100vh-100px)] custom_scrollbar rounded-md overflow-y-auto py-6 pl-6">
          {renderDocumentContent()}
        </div>

        <div className="fixed bottom-5 right-5">
          <Button
            onClick={handleCreatePresentation}
            className="flex items-center gap-2 px-8 py-6 rounded-sm text-md bg-[#5146E5] hover:bg-[#5146E5]/90"
          >
            <span className="text-white font-semibold">Next</span>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPreviewPage;
