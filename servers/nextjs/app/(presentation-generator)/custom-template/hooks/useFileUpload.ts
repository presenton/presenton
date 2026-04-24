import { useState, useCallback } from "react";
import { toast } from "sonner";

export const useFileUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const lowerName = file.name.toLowerCase();
      const isPptx = lowerName.endsWith(".pptx");
      if (!isPptx) {
        toast.error("Please select a valid PPTX file");
        return;
      }

      // Validate file size (100MB limit)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error("File size must be less than 100MB");
        return;
      }

      setSelectedFile(file);
    },
    []
  );

  const removeFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return {
    selectedFile,
    handleFileSelect,
    removeFile,
  };
}; 