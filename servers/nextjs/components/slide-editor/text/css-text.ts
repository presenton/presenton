export function cssFontFamilyStack(family: string) {
  const escapedFamily = family
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n\f]/g, " ");
  return `"${escapedFamily || "Arial"}", Helvetica, sans-serif`;
}
