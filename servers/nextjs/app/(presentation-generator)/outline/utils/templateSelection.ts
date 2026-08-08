export const TEMPLATE_SELECTION_PREFIX = "template-v2:";

export function createTemplateSelectionId(templateId: string): string {
  return `${TEMPLATE_SELECTION_PREFIX}${templateId}`;
}

export function parseTemplateSelectionId(selection: string): string | null {
  if (!selection.startsWith(TEMPLATE_SELECTION_PREFIX)) return null;
  const templateId = selection.slice(TEMPLATE_SELECTION_PREFIX.length);
  return templateId || null;
}
