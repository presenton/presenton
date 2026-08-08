import Image from "next/image";
import {
  Check,
  ChevronDown,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  RotateCcw,
  Scan,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "@/components/slide-editor/model/model";
import {
  averageBorderRadius,
  elementBox,
  uniformBorderRadius,
} from "@/components/slide-editor/model/element-model";
import type { ImageSlideElement } from "@/components/slide-editor/state/state";
import {
  FloatingToolbar,
  FloatingToolbarPanel,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import { OpacitySwatchIcon } from "@/components/slide-editor/toolbar/OpacitySwatchIcon";
import { ImagePickerModal } from "@/components/slide-editor/images/ImagePickerModal";
import { resolveBackendAssetSource } from "@/utils/api";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import { notify } from "@/components/ui/sonner";

type ImagePanel = "fit" | "crop" | "radius" | "opacity" | null;
type ImageFit = "contain" | "cover" | "fill";
type CropPoint = { x: number; y: number };
type CropFrame = { left: number; top: number; width: number; height: number };
type CropDraft = CropPoint & { scale: number };
type CropImageFrame = CropFrame;
type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type CropDragState =
  | {
    kind: "move";
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startImageFrame: CropImageFrame;
    startScale: number;
  }
  | {
    kind: "scale";
    handle: CropHandle;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startDraft: CropDraft;
    startImageFrame: CropImageFrame;
  };

const FIT_OPTIONS: Array<{ label: string; value: ImageFit }> = [
  { label: "Fill", value: "cover" },
  { label: "Contain", value: "contain" },
  { label: "Stretch", value: "fill" },
];

const FIT_LABELS: Record<ImageFit, string> = {
  contain: "Contain",
  cover: "Fill",
  fill: "Stretch",
};

const clampPercent = (value: number | null | undefined) =>
  Math.min(100, Math.max(0, value ?? 50));

const CROP_ACTION_BAR_WIDTH = 118;
const CROP_ACTION_BAR_HEIGHT = 42;
const CROP_PANEL_MARGIN = 10;
const IMAGE_TOOLBAR_HEIGHT = 44;
const IMAGE_TOOLBAR_TOP_OFFSET = 64;
const CROP_PANEL_TOOLBAR_GAP = 8;
const MIN_CROP_SCALE = 0.1;
const MAX_CROP_SCALE = 6;
const CROP_HANDLE_SIZE = 12;
const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024;

const CROP_HANDLES: Array<{ label: string; value: CropHandle }> = [
  { label: "Top left resize handle", value: "nw" },
  { label: "Top resize handle", value: "n" },
  { label: "Top right resize handle", value: "ne" },
  { label: "Right resize handle", value: "e" },
  { label: "Bottom right resize handle", value: "se" },
  { label: "Bottom resize handle", value: "s" },
  { label: "Bottom left resize handle", value: "sw" },
  { label: "Left resize handle", value: "w" },
];

function normalizeCropDraft(draft: CropDraft): CropDraft {
  return {
    x: clampPercent(draft.x),
    y: clampPercent(draft.y),
    scale: clampCropScale(draft.scale),
  };
}

function clampCropScale(value: number | null | undefined) {
  return clampNumber(value ?? 1, MIN_CROP_SCALE, MAX_CROP_SCALE);
}

function sameCropDraft(a: CropDraft, b: CropDraft) {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.scale - b.scale) < 0.01
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cropActionsPosition(frame: CropFrame) {
  const width = Math.min(CROP_ACTION_BAR_WIDTH, STAGE_WIDTH - CROP_PANEL_MARGIN * 2);
  const toolbarTop = Math.max(
    CROP_PANEL_MARGIN,
    frame.top - IMAGE_TOOLBAR_TOP_OFFSET,
  );
  const toolbarBottom = toolbarTop + IMAGE_TOOLBAR_HEIGHT;
  const minTopBelowToolbar = toolbarBottom + CROP_PANEL_TOOLBAR_GAP;
  const left = clampNumber(
    frame.left + frame.width / 2,
    CROP_PANEL_MARGIN + width / 2,
    STAGE_WIDTH - CROP_PANEL_MARGIN - width / 2,
  );
  const below = frame.top + frame.height + 12;
  const above = frame.top - CROP_ACTION_BAR_HEIGHT - 12;
  const top =
    below + CROP_ACTION_BAR_HEIGHT <= STAGE_HEIGHT - CROP_PANEL_MARGIN
      ? below
      : clampNumber(
        Math.max(above, minTopBelowToolbar),
        CROP_PANEL_MARGIN,
        STAGE_HEIGHT - CROP_PANEL_MARGIN - CROP_ACTION_BAR_HEIGHT,
      );

  return { left, top, width };
}

function imageNaturalRatio(size: { width: number; height: number } | null) {
  return size && size.width > 0 && size.height > 0 ? size.width / size.height : 1;
}

function baseCoverImageSize(
  frame: CropFrame,
  naturalSize: { width: number; height: number } | null,
) {
  const naturalRatio = imageNaturalRatio(naturalSize);
  const frameRatio = frame.width / frame.height || 1;
  if (naturalRatio > frameRatio) {
    return {
      width: frame.height * naturalRatio,
      height: frame.height,
    };
  }
  return {
    width: frame.width,
    height: frame.width / naturalRatio,
  };
}

function cropImageFrameForDraft(
  frame: CropFrame,
  naturalSize: { width: number; height: number } | null,
  draft: CropDraft,
): CropImageFrame {
  const baseSize = baseCoverImageSize(frame, naturalSize);
  const width = baseSize.width * draft.scale;
  const height = baseSize.height * draft.scale;
  const horizontalSpace = frame.width - width;
  const verticalSpace = frame.height - height;
  return {
    left: frame.left + horizontalSpace * (draft.x / 100),
    top: frame.top + verticalSpace * (draft.y / 100),
    width,
    height,
  };
}

function constrainCropImageFrame(
  cropFrame: CropFrame,
  imageFrame: CropImageFrame,
): CropImageFrame {
  const horizontalRange = cropFrame.width - imageFrame.width;
  const verticalRange = cropFrame.height - imageFrame.height;
  const minLeft =
    horizontalRange >= 0
      ? cropFrame.left
      : cropFrame.left + horizontalRange;
  const maxLeft =
    horizontalRange >= 0
      ? cropFrame.left + horizontalRange
      : cropFrame.left;
  const minTop =
    verticalRange >= 0
      ? cropFrame.top
      : cropFrame.top + verticalRange;
  const maxTop =
    verticalRange >= 0
      ? cropFrame.top + verticalRange
      : cropFrame.top;
  return {
    ...imageFrame,
    left: clampNumber(imageFrame.left, minLeft, maxLeft),
    top: clampNumber(imageFrame.top, minTop, maxTop),
  };
}

function cropDraftFromImageFrame(
  cropFrame: CropFrame,
  imageFrame: CropImageFrame,
  scale: number,
): CropDraft {
  const overflowX = Math.max(0, imageFrame.width - cropFrame.width);
  const overflowY = Math.max(0, imageFrame.height - cropFrame.height);
  const availableX = Math.max(0, cropFrame.width - imageFrame.width);
  const availableY = Math.max(0, cropFrame.height - imageFrame.height);
  return normalizeCropDraft({
    x:
      overflowX > 0
        ? ((cropFrame.left - imageFrame.left) / overflowX) * 100
        : availableX > 0
          ? ((imageFrame.left - cropFrame.left) / availableX) * 100
          : 50,
    y:
      overflowY > 0
        ? ((cropFrame.top - imageFrame.top) / overflowY) * 100
        : availableY > 0
          ? ((imageFrame.top - cropFrame.top) / availableY) * 100
          : 50,
    scale,
  });
}

function cropScaleFromHandleDrag(
  handle: CropHandle,
  dragState: Extract<CropDragState, { kind: "scale" }>,
  clientX: number,
  clientY: number,
) {
  const dx = clientX - dragState.startClientX;
  const dy = clientY - dragState.startClientY;
  const widthDirection = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0;
  const heightDirection = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0;
  const scaleFactors = [];
  if (widthDirection) {
    scaleFactors.push(
      (dragState.startImageFrame.width + dx * widthDirection) /
        dragState.startImageFrame.width,
    );
  }
  if (heightDirection) {
    scaleFactors.push(
      (dragState.startImageFrame.height + dy * heightDirection) /
        dragState.startImageFrame.height,
    );
  }
  const scaleFactor = scaleFactors.length ? Math.max(...scaleFactors) : 1;
  return clampCropScale(dragState.startDraft.scale * scaleFactor);
}

export function ImageToolbar({
  anchorBox,
  element,
  index,
  scale,
  onChange,
  onCropModeChange,
}: {
  anchorBox?: FloatingToolbarBox | null;
  element: ImageSlideElement;
  index: number;
  scale: number;
  onChange: (index: number, element: ImageSlideElement) => void;
  onCropModeChange?: (active: boolean) => void;
}) {
  const [openPanel, setOpenPanel] = useState<ImagePanel>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fit = element.fit ?? "contain";
  const maxRadius = Math.max(
    0.01,
    Math.min(element.size?.width ?? 1, element.size?.height ?? 1) / 2,
  );
  const radius = Math.min(
    maxRadius,
    averageBorderRadius(element.border_radius),
  );
  const focusX = clampPercent(element.focus_x);
  const focusY = clampPercent(element.focus_y);
  const cropScale = clampCropScale(element.crop_scale);
  const box = elementBox(element);
  const imageSource = resolveBackendAssetSource(element.data ?? "");
  const cropFrame = {
    left: box.x * scale,
    top: box.y * scale,
    width: box.w * scale,
    height: box.h * scale,
  };
  const cropActions = cropActionsPosition(cropFrame);
  const [cropDraft, setCropDraft] = useState<CropDraft>({
    x: focusX,
    y: focusY,
    scale: cropScale,
  });
  const [imageNaturalSize, setImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [radiusDraft, setRadiusDraft] = useState(radius);
  const [opacityDraft, setOpacityDraft] = useState(element.opacity ?? 1);
  const cropDragRef = useRef<CropDragState | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cropImageFrame = cropImageFrameForDraft(
    cropFrame,
    imageNaturalSize,
    cropDraft,
  );
  const committedCropRef = useRef({
    fit,
    draft: { x: focusX, y: focusY, scale: cropScale },
  });

  useEffect(() => {
    setRadiusDraft(radius);
  }, [radius]);

  useEffect(() => {
    setOpacityDraft(element.opacity ?? 1);
  }, [element.opacity]);

  useEffect(() => {
    if (openPanel === "crop") {
      setCropDraft({ x: focusX, y: focusY, scale: cropScale });
    }
  }, [cropScale, focusX, focusY, openPanel]);

  useEffect(() => {
    const active = openPanel === "crop";
    onCropModeChange?.(active);
    return () => {
      if (active) onCropModeChange?.(false);
    };
  }, [onCropModeChange, openPanel]);

  useEffect(() => {
    if (!imageSource || typeof window === "undefined") {
      setImageNaturalSize(null);
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      setImageNaturalSize({
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1,
      });
    };
    image.onerror = () => {
      if (!cancelled) setImageNaturalSize(null);
    };
    image.src = imageSource;
    if (image.complete && (image.naturalWidth || image.width)) {
      setImageNaturalSize({
        width: image.naturalWidth || image.width || 1,
        height: image.naturalHeight || image.height || 1,
      });
    }

    return () => {
      cancelled = true;
    };
  }, [imageSource]);

  useEffect(() => {
    committedCropRef.current = {
      fit,
      draft: { x: focusX, y: focusY, scale: cropScale },
    };
  }, [cropScale, fit, focusX, focusY]);

  const update = (changes: Partial<ImageSlideElement>) => {
    onChange(index, { ...element, ...changes });
  };

  const commitCrop = (next = cropDraft) => {
    const draft = normalizeCropDraft(next);
    const committed = committedCropRef.current;
    if (committed.fit === "cover" && sameCropDraft(draft, committed.draft)) {
      return;
    }
    committedCropRef.current = { fit: "cover", draft };
    update({
      fit: "cover",
      focus_x: draft.x,
      focus_y: draft.y,
      crop_scale:
        Math.abs(draft.scale - 1) > 0.01 ? draft.scale : null,
    });
  };

  const draftFromCropDrag = (
    dragState: CropDragState,
    clientX: number,
    clientY: number,
  ) => {
    if (dragState.kind === "scale") {
      return normalizeCropDraft({
        ...dragState.startDraft,
        scale: cropScaleFromHandleDrag(
          dragState.handle,
          dragState,
          clientX,
          clientY,
        ),
      });
    }

    const nextFrame = constrainCropImageFrame(cropFrame, {
      ...dragState.startImageFrame,
      left: dragState.startImageFrame.left + clientX - dragState.startClientX,
      top: dragState.startImageFrame.top + clientY - dragState.startClientY,
    });
    return cropDraftFromImageFrame(cropFrame, nextFrame, dragState.startScale);
  };

  const handleCropPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = cropDragRef.current;
    if (!dragState) return;
    event.preventDefault();
    event.stopPropagation();
    setCropDraft(draftFromCropDrag(dragState, event.clientX, event.clientY));
  };

  const handleCropPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = cropDragRef.current;
    if (!dragState) return;
    event.preventDefault();
    event.stopPropagation();
    const next = draftFromCropDrag(dragState, event.clientX, event.clientY);
    cropDragRef.current = null;
    setCropDraft(next);
    commitCrop(next);
  };

  const handleCropPointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (!cropDragRef.current) return;
    event.stopPropagation();
    cropDragRef.current = null;
  };

  const handleCropKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    const focusStep = event.shiftKey ? 10 : 2;
    const scaleStep = event.shiftKey ? 0.25 : 0.1;
    let next: CropDraft | null = null;

    if (event.key === "ArrowLeft") {
      next = { ...cropDraft, x: cropDraft.x - focusStep };
    } else if (event.key === "ArrowRight") {
      next = { ...cropDraft, x: cropDraft.x + focusStep };
    } else if (event.key === "ArrowUp") {
      next = { ...cropDraft, y: cropDraft.y - focusStep };
    } else if (event.key === "ArrowDown") {
      next = { ...cropDraft, y: cropDraft.y + focusStep };
    } else if (event.key === "+" || event.key === "=") {
      next = { ...cropDraft, scale: cropDraft.scale + scaleStep };
    } else if (event.key === "-" || event.key === "_") {
      next = { ...cropDraft, scale: cropDraft.scale - scaleStep };
    } else if (event.key === "Enter") {
      commitCrop();
      setOpenPanel(null);
      return;
    } else if (event.key === "Escape") {
      setOpenPanel(null);
      return;
    }

    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    const normalized = normalizeCropDraft(next);
    setCropDraft(normalized);
    commitCrop(normalized);
  };

  const togglePanel = (panel: Exclude<ImagePanel, null>) => {
    const willOpen = openPanel !== panel;
    setOpenPanel(willOpen ? panel : null);
  };
  const commitRadius = (value: number) => {
    const next = clampNumber(value, 0, maxRadius);
    setRadiusDraft(next);
    update({ border_radius: uniformBorderRadius(next) });
  };

  const uploadReplacementImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify.error("Upload failed", "Please choose a valid image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      notify.error("Upload failed", "Image files must be smaller than 5MB.");
      return;
    }

    setOpenPanel(null);
    setIsUploadingImage(true);
    try {
      const asset = await ImagesApi.uploadImage(file);
      const url = resolveBackendAssetSource(asset);
      if (!url) throw new Error("Upload did not return an image URL.");
      update({
        data: url,
        name: file.name,
        focus_x: 50,
        focus_y: 50,
        crop_scale: null,
      });
      notify.success("Image uploaded", "The selected image was replaced.");
    } catch (uploadError: unknown) {
      notify.error(
        "Upload failed",
        uploadError instanceof Error ? uploadError.message : "Could not upload image.",
      );
    } finally {
      setIsUploadingImage(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleUploadInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void uploadReplacementImage(event.currentTarget.files?.[0]);
  };

  return (
    <>
      <FloatingToolbar
        anchorBox={
          anchorBox ?? {
            x: box.x * scale,
            y: box.y * scale,
            width: box.w * scale,
            height: box.h * scale,
          }
        }
        fallbackWidth={360}
        inlineEditIgnore
        className="inline-flex items-center gap-3 rounded-[6px] bg-white px-[10px] py-[6px] text-[#191919] shadow-[0_0_4px_rgba(0,0,0,0.15)]"
      >
        <div className="relative">
          <button
            type="button"
            title={`Image type: ${FIT_LABELS[fit]}`}
            aria-label={`Image type: ${FIT_LABELS[fit]}`}
            aria-expanded={openPanel === "fit"}
            onClick={() => togglePanel("fit")}
            className="flex min-w-[83px] items-center justify-between gap-2 rounded-[10px] border-0 bg-transparent py-[6px] text-[14px] font-medium font-syne leading-4"
          >
            <span>{FIT_LABELS[fit]}</span>
            <ChevronDown
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
              className="transition-transform"
            />
          </button>
          {openPanel === "fit" ? (
            <Panel className="flex min-w-[170px] flex-col gap-1 rounded-[12px] p-2.5">
              {FIT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={fit === option.value}
                  onClick={() => {
                    update({ fit: option.value });
                  }}
                  className={cn(
                    "flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[13px] text-[#191919] hover:bg-[#F4F3FF]",
                    fit === option.value && "bg-[#F4F1FF] text-[#7A5AF8]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </Panel>
          ) : null}
        </div>

        <Divider />

        <button
          type="button"
          title="Upload image"
          aria-label="Upload image"
          onClick={() => uploadInputRef.current?.click()}
          disabled={isUploadingImage}
          className="rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF] disabled:cursor-wait disabled:opacity-50"
        >
          {isUploadingImage ? (
            <Loader2 size={16} strokeWidth={1.8} aria-hidden="true" className="animate-spin" />
          ) : (
            <Upload size={16} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          title="Replace image"
          aria-label="Replace image"
          onClick={() => {
            setOpenPanel(null);
            setImagePickerOpen(true);
          }}
          className="rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF]"
        >
          <Image
            alt=""
            aria-hidden="true"
            height={16}
            src="/figma-assets/image-replace.svg"
            unoptimized
            width={16}
            className="size-4"
          />
        </button>

        <Divider />
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Crop image"
            aria-label="Crop image"
            aria-pressed={openPanel === "crop"}
            onClick={() => togglePanel("crop")}
            className={cn(
              "rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF]",
              openPanel === "crop" && "bg-[#F4F1FF] text-[#7C3AED]",
            )}
          >
            <Crop size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>

          <button
            type="button"
            title="Flip horizontally"
            aria-label="Flip horizontally"
            aria-pressed={element.flip_h === true}
            onClick={() => update({ flip_h: !(element.flip_h ?? false) })}
            className={cn(
              "rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF]",
              element.flip_h === true && "bg-[#F4F1FF] text-[#7C3AED]",
            )}
          >
            <FlipHorizontal2 size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>

          <button
            type="button"
            title="Flip vertically"
            aria-label="Flip vertically"
            aria-pressed={element.flip_v === true}
            onClick={() => update({ flip_v: !(element.flip_v ?? false) })}
            className={cn(
              "rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF]",
              element.flip_v === true && "bg-[#F4F1FF] text-[#7C3AED]",
            )}
          >
            <FlipVertical2 size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>

          <div className="relative">
            <button
              type="button"
              title="Image border radius"
              aria-label="Image border radius"
              aria-pressed={openPanel === "radius"}
              onClick={() => togglePanel("radius")}
              className={cn(
                "rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF]",
                openPanel === "radius" && "bg-[#F4F1FF] text-[#7C3AED]",
              )}
            >
              <Scan size={16} strokeWidth={1.7} aria-hidden="true" />
            </button>
            {openPanel === "radius" ? (
              <Panel className="w-[220px] p-3">
                <label className="block text-[12px] font-medium text-[#4B5563]">
                  <span className="mb-2 flex items-center justify-between">
                    <span>Border radius</span>
                    <span className="font-medium text-[#191919]">
                      {formatRadiusValue(radiusDraft)}
                    </span>
                  </span>
                  <input
                    aria-label="Image border radius"
                    type="range"
                    min={0}
                    max={maxRadius}
                    step={Math.max(0.01, maxRadius / 100)}
                    value={radiusDraft}
                    onChange={(event) =>
                      setRadiusDraft(Number(event.currentTarget.value))
                    }
                    onBlur={(event) =>
                      commitRadius(Number(event.currentTarget.value))
                    }
                    onKeyUp={(event) =>
                      commitRadius(Number(event.currentTarget.value))
                    }
                    onPointerUp={(event) =>
                      commitRadius(Number(event.currentTarget.value))
                    }
                    className="w-full cursor-pointer accent-[#7A5AF8]"
                  />
                </label>
              </Panel>
            ) : null}
          </div>
        </div>
        <Divider />

        <div className="relative">
          <button
            type="button"
            title="Image opacity"
            aria-label="Image opacity"
            aria-pressed={openPanel === "opacity"}
            onClick={() => togglePanel("opacity")}
            className={cn(
              "rounded-[2px] border-0 bg-transparent p-1 text-[#05070A] hover:bg-[#F4F3FF]",
              openPanel === "opacity" && "bg-[#F4F1FF] text-[#7C3AED]",
            )}
          >
            <OpacitySwatchIcon />
          </button>
          {openPanel === "opacity" ? (
            <Panel className="flex min-w-[115px] items-center p-2.5">
              <input
                aria-label="Image opacity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opacityDraft}
                onChange={(event) => setOpacityDraft(Number(event.target.value))}
                onKeyUp={(event) =>
                  update({ opacity: Number((event.target as HTMLInputElement).value) })
                }
                onPointerUp={(event) =>
                  update({ opacity: Number((event.target as HTMLInputElement).value) })
                }
                className="w-full cursor-pointer accent-[#7A5AF8]"
              />
            </Panel>
          ) : null}
        </div>
      </FloatingToolbar>
      <input
        ref={uploadInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={handleUploadInputChange}
      />
      {openPanel === "crop" ? (
        <>
          <CropOverlay
            borderRadius={radius * scale}
            cropDraft={cropDraft}
            frame={cropFrame}
            imageFrame={cropImageFrame}
            imageSource={imageSource}
            flipH={element.flip_h === true}
            flipV={element.flip_v === true}
            stageHeight={STAGE_HEIGHT * scale}
            stageWidth={STAGE_WIDTH * scale}
            onCropKeyDown={handleCropKeyDown}
            onHandlePointerDown={(handle, event) => {
              const target = event.currentTarget;
              event.preventDefault();
              event.stopPropagation();
              target.setPointerCapture(event.pointerId);
              cropDragRef.current = {
                kind: "scale",
                handle,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startDraft: cropDraft,
                startImageFrame: cropImageFrame,
              };
            }}
            onImagePointerDown={(event) => {
              const target = event.currentTarget;
              event.preventDefault();
              event.stopPropagation();
              target.setPointerCapture(event.pointerId);
              cropDragRef.current = {
                kind: "move",
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startImageFrame: cropImageFrame,
                startScale: cropDraft.scale,
              };
            }}
            onPointerCancel={handleCropPointerCancel}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerEnd}
          />
          <CropActions
            position={cropActions}
            onDone={() => {
              commitCrop();
              setOpenPanel(null);
            }}
            onReset={() => {
              const next = { x: 50, y: 50, scale: MIN_CROP_SCALE };
              setCropDraft(next);
              commitCrop(next);
            }}
            onClose={() => setOpenPanel(null)}
          />
        </>
      ) : null}
      <ImagePickerModal
        open={imagePickerOpen}
        currentImage={element.data}
        initialPrompt={element.prompt}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(url, prompt) => {
          update({
            data: url,
            focus_x: 50,
            focus_y: 50,
            crop_scale: null,
            ...(prompt ? { prompt } : {}),
          });
        }}
      />
    </>

  );
}

function CropOverlay({
  borderRadius,
  cropDraft,
  frame,
  imageFrame,
  imageSource,
  flipH,
  flipV,
  stageHeight,
  stageWidth,
  onCropKeyDown,
  onHandlePointerDown,
  onImagePointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  borderRadius: number;
  cropDraft: CropDraft;
  frame: CropFrame;
  imageFrame: CropImageFrame;
  imageSource: string;
  flipH: boolean;
  flipV: boolean;
  stageHeight: number;
  stageWidth: number;
  onCropKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onHandlePointerDown: (
    handle: CropHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onImagePointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const transform = [flipH ? "scaleX(-1)" : "", flipV ? "scaleY(-1)" : ""]
    .filter(Boolean)
    .join(" ");
  const cropLabel = `Crop image. Zoom ${Math.round(cropDraft.scale * 100)} percent.`;

  return (
    <div
      data-template-v2-floating-toolbar="true"
      data-inline-edit-ignore="true"
      className="pointer-events-none absolute left-0 top-0 z-[8] touch-none"
      style={{
        height: stageHeight,
        width: stageWidth,
      }}
    >
      <CropShade frame={frame} stageHeight={stageHeight} stageWidth={stageWidth} />
      {imageSource ? (
        <div
          aria-label={cropLabel}
          className="pointer-events-auto absolute z-[2] cursor-grab touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2"
          style={{
            height: imageFrame.height,
            left: imageFrame.left,
            top: imageFrame.top,
            width: imageFrame.width,
          }}
          tabIndex={0}
          onKeyDown={onCropKeyDown}
          onPointerCancel={(event) => onPointerCancel(event)}
          onPointerDown={onImagePointerDown}
          onPointerMove={(event) => onPointerMove(event)}
          onPointerUp={(event) => onPointerUp(event)}
        >
          <Image
            alt=""
            fill
            draggable={false}
            unoptimized
            src={imageSource}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            sizes={`${Math.max(1, Math.round(imageFrame.width))}px`}
            style={{
              objectFit: "fill",
              transform: transform || undefined,
            }}
          />
          <div className="pointer-events-none absolute inset-0 border-2 border-[#7C3AED]" />
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-[4] border-2 border-[#7C3AED] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
        style={{
          borderRadius,
          height: frame.height,
          left: frame.left,
          top: frame.top,
          width: frame.width,
        }}
      />
      {imageSource ? (
        CROP_HANDLES.map((handle) => (
          <button
            key={handle.value}
            type="button"
            title={handle.label}
            aria-label={handle.label}
            className="pointer-events-auto absolute z-[5] rounded-full border border-[#D6D3E8] bg-white shadow-[0_1px_4px_rgba(17,24,39,0.24)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
            style={cropHandleStyle(handle.value, imageFrame)}
            onPointerCancel={(event) => onPointerCancel(event)}
            onPointerDown={(event) => onHandlePointerDown(handle.value, event)}
            onPointerMove={(event) => onPointerMove(event)}
            onPointerUp={(event) => onPointerUp(event)}
          />
        ))
      ) : null}
    </div>
  );
}

function CropShade({
  frame,
  stageHeight,
  stageWidth,
}: {
  frame: CropFrame;
  stageHeight: number;
  stageWidth: number;
}) {
  const right = Math.max(0, stageWidth - frame.left - frame.width);
  const bottom = Math.max(0, stageHeight - frame.top - frame.height);

  return (
    <>
      <div
        className="pointer-events-none absolute z-[3] bg-black/20"
        style={{ height: Math.max(0, frame.top), left: 0, top: 0, width: stageWidth }}
      />
      <div
        className="pointer-events-none absolute z-[3] bg-black/20"
        style={{
          height: bottom,
          left: 0,
          top: frame.top + frame.height,
          width: stageWidth,
        }}
      />
      <div
        className="pointer-events-none absolute z-[3] bg-black/20"
        style={{
          height: frame.height,
          left: 0,
          top: frame.top,
          width: Math.max(0, frame.left),
        }}
      />
      <div
        className="pointer-events-none absolute z-[3] bg-black/20"
        style={{
          height: frame.height,
          left: frame.left + frame.width,
          top: frame.top,
          width: right,
        }}
      />
    </>
  );
}

function cropHandleStyle(handle: CropHandle, imageFrame: CropImageFrame): CSSProperties {
  const half = CROP_HANDLE_SIZE / 2;
  const style: CSSProperties = {
    height: CROP_HANDLE_SIZE,
    width: CROP_HANDLE_SIZE,
  };

  if (handle.includes("n")) style.top = imageFrame.top - half;
  else if (handle.includes("s")) style.top = imageFrame.top + imageFrame.height - half;
  else {
    style.top = imageFrame.top + imageFrame.height / 2 - half;
  }

  if (handle.includes("w")) style.left = imageFrame.left - half;
  else if (handle.includes("e")) style.left = imageFrame.left + imageFrame.width - half;
  else {
    style.left = imageFrame.left + imageFrame.width / 2 - half;
  }

  if (handle === "nw" || handle === "se") {
    style.cursor = "nwse-resize";
  } else if (handle === "ne" || handle === "sw") {
    style.cursor = "nesw-resize";
  } else if (handle === "n" || handle === "s") {
    style.cursor = "ns-resize";
  } else {
    style.cursor = "ew-resize";
  }

  return style;
}

function CropActions({
  position,
  onDone,
  onReset,
  onClose,
}: {
  position: { left: number; top: number; width: number };
  onDone: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-template-v2-floating-toolbar="true"
      data-inline-edit-ignore="true"
      className="absolute z-[10000] flex h-[42px] items-center justify-center gap-1.5 rounded-[10px] border border-[#E7E8EC] bg-white px-2 font-syne text-[#191919] shadow-[0_8px_24px_rgba(16,24,40,0.14)]"
      style={{
        left: position.left,
        top: position.top,
        transform: "translateX(-50%)",
        width: position.width,
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title="Reset crop"
        aria-label="Reset crop"
        onClick={onReset}
        className="rounded-[6px] p-2 text-[#4B5563] hover:bg-[#F4F3FF] hover:text-[#191919]"
      >
        <RotateCcw size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        title="Apply crop"
        aria-label="Apply crop"
        onClick={onDone}
        className="rounded-[6px] bg-[#111827] p-2 text-white hover:bg-[#0B1220]"
      >
        <Check size={16} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        title="Close crop controls"
        aria-label="Close crop controls"
        onClick={onClose}
        className="rounded-[6px] p-2 text-[#4B5563] hover:bg-[#F4F3FF] hover:text-[#191919]"
      >
        <X size={17} strokeWidth={1.9} />
      </button>
    </div>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FloatingToolbarPanel
      className={cn(
        "absolute left-1/2 top-[calc(100%+8px)] z-10 box-border -translate-x-1/2 rounded-lg bg-white shadow-[0_0_4px_rgba(0,0,0,0.16)]",
        className,
      )}
    >
      {children}
    </FloatingToolbarPanel>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-[23px] w-px flex-none bg-[#EDEEEF]" />;
}

function formatRadiusValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(1)).toString();
}
