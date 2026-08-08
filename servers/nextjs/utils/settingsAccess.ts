export type SettingsView = "admin" | "account";

export function getSettingsView(
  role: "admin" | "user" | null
): SettingsView {
  return role === "admin" ? "admin" : "account";
}
