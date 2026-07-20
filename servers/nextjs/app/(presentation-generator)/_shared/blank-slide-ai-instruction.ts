type BlankSlideAiInstructionOptions = {
  slideIndex?: number | null;
  layoutId?: string | null;
  promptKind?: "blank" | "layout";
};

export function createBlankSlideAiInstruction({
  slideIndex,
  layoutId,
  promptKind = "blank",
}: BlankSlideAiInstructionOptions): string {
  const target =
    typeof slideIndex === "number"
      ? `slide ${slideIndex + 1}`
      : "the current blank slide";
  const layoutReference =
    typeof layoutId === "string" && layoutId.trim()
      ? ` (layout id: ${layoutId.trim()})`
      : "";

  if (promptKind === "layout") {
    return `Fill the existing selected ${target} using its selected layout${layoutReference} as the layout reference. Preserve the layout structure and update this slide; do not add another slide.`;
  }

  return `Transform the existing selected ${target} into a presentation-ready slide. Treat its Title and Subtitle placeholders as an editable brief: improve or rewrite their copy when appropriate, expand the brief into useful content, and apply an appropriate visual design or layout. Update this slide; do not add another slide.`;
}
