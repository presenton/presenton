import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SLIDES_SCROLL_CONTAINER_SELECTOR =
  "[data-presentation-slides-scroll-container='true']";

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

  const scrollToSlide = useCallback((
    index: number,
    attempts = 2,
    behavior: ScrollBehavior = "auto",
  ) => {
    const slideElement = document.getElementById(`slide-${index}`);
    if (slideElement) {
      const scrollContainer = slideElement.closest<HTMLElement>(
        SLIDES_SCROLL_CONTAINER_SELECTOR
      );
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const slideRect = slideElement.getBoundingClientRect();
        const top =
          slideRect.top - containerRect.top + scrollContainer.scrollTop;

        scrollContainer.scrollTo({ top, behavior });
        return;
      }

      slideElement.scrollIntoView({ behavior, block: "start" });
      return;
    }
    if (attempts > 0) {
      window.requestAnimationFrame(() =>
        scrollToSlide(index, attempts - 1, behavior)
      );
    }
  }, []);

  const handleSlideClick = useCallback((index: number) => {
    setSelectedSlide(index);
    window.requestAnimationFrame(() => scrollToSlide(index, 2, "auto"));
  }, [scrollToSlide, setSelectedSlide]);

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
    scrollToSlide,
    handleSlideClick,
    toggleFullscreen,
    handlePresentExit,
    handleSlideChange,
  };
};
