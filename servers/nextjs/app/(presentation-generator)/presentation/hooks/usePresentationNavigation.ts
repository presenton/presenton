import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const usePresentationNavigation = (
  presentationId: string,
  selectedSlide: number,
  setSelectedSlide: (slide: number) => void,
  setIsFullscreen: (fullscreen: boolean) => void
) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isPresentMode = searchParams.get("mode") === "present";
  const stream = searchParams.get("stream");
  const currentSlide = parseInt(
    searchParams.get("slide") || `${selectedSlide}` || "0"
  );

  const handleSlideClick = useCallback((index: number) => {
    setSelectedSlide(index);
    const slideElement = document.getElementById(`slide-${index}`);
    if (slideElement) {
      slideElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [setSelectedSlide]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, [setIsFullscreen]);

  const toggleFullscreen = useCallback((target?: Element | null) => {
    if (!document.fullscreenElement) {
      const fullscreenTarget =
        target ?? document.getElementById("presentation-mode-wrapper") ?? document.documentElement;
      fullscreenTarget
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(false));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(Boolean(document.fullscreenElement)));
    }
  }, [setIsFullscreen]);

  const handlePresentExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    setIsFullscreen(false);
    router.push(`/presentation?id=${presentationId}`);
  }, [router, presentationId, setIsFullscreen]);

  const handleSlideChange = useCallback((newSlide: number, presentationData: any) => {
    if (newSlide >= 0 && newSlide < presentationData?.slides.length!) {
      setSelectedSlide(newSlide);
      router.push(
        `/presentation?id=${presentationId}&mode=present&slide=${newSlide}`,
        { scroll: false }
      );
    }
  }, [router, presentationId, setSelectedSlide]);

  return {
    isPresentMode,
    stream,
    currentSlide,
    handleSlideClick,
    toggleFullscreen,
    handlePresentExit,
    handleSlideChange,
  };
};
