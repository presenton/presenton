"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify } from "@/components/ui/sonner";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { formatFastApiDetail } from "@/utils/authErrors";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { useI18n } from "@/i18n/provider";
import LanguageSelector from "@/components/LanguageSelector";

type AdminUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at?: string | null;
};

type ApiKey = {
  token: string;
  user_id: string;
  created_at: string;
};

type AdminDialog =
  | { kind: "reset-password"; user: AdminUser }
  | { kind: "delete-user"; user: AdminUser }
  | { kind: "revoke-key"; key: ApiKey }
  | null;

type AdminPanelProps = {
  embedded?: boolean;
};

async function errorDetail(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.detail === undefined
    ? `Request failed (${response.status})`
    : formatFastApiDetail(payload.detail);
}

function maskedKey(token: string) {
  return `••••••••••••••••${token.slice(-4)}`;
}

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7C51F8] px-5 text-xs font-semibold text-white transition hover:bg-[#6D46E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const inputClass =
  "h-11 w-full rounded-lg border border-[#E1E1E5] bg-white px-4 text-sm text-[#101323] outline-none transition placeholder:text-[#98A2B3] focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/15";

export default function AdminPanel({ embedded = false }: AdminPanelProps) {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AdminDialog>(null);

  const loadUsers = useCallback(async (
    trigger: "initial" | "manual" | "user_created" | "user_deleted" = "initial"
  ) => {
    setBusy("users");
    try {
      const response = await fetch("/api/v1/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const loadedUsers = (await response.json()) as AdminUser[];
        setUsers(loadedUsers);
        trackEvent(MixpanelEvent.Auth_Admin_User_List_Loaded, {
          trigger,
          user_count: loadedUsers.length,
        });
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_List_Failed, {
          trigger,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotLoadUsers"), detail);
      }
    } catch (loadError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_List_Failed, {
        trigger,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          loadError,
          "Could not load users"
        ),
      });
      notify.error(t("admin.couldNotLoadUsers"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  }, [t]);

  const loadKeys = useCallback(async () => {
    setBusy("keys");
    try {
      const response = await fetch("/api/v1/auth/token/list", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const loadedKeys = (await response.json()) as ApiKey[];
        setKeys(loadedKeys);
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_List_Loaded, {
          api_key_count: loadedKeys.length,
        });
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_List_Failed, {
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotLoadApiKeys"), detail);
      }
    } catch (loadError) {
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_List_Failed, {
        status_code: null,
        error_message: sanitizeAnalyticsError(
          loadError,
          "Could not load API keys"
        ),
      });
      notify.error(t("admin.couldNotLoadApiKeys"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  }, [t]);

  useEffect(() => {
    trackEvent(MixpanelEvent.Auth_Admin_Viewed, {
      embedded,
    });
    void Promise.all([loadUsers(), loadKeys()]);
  }, [embedded, loadKeys, loadUsers]);

  const addUser = async (event: FormEvent) => {
    event.preventDefault();
    const cleanedUsername = username.trim();
    setBusy("add");
    trackEvent(MixpanelEvent.Auth_Admin_User_Create_Started, {
      username_length: cleanedUsername.length,
      user_count_before: users.length,
    });
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanedUsername, password }),
      });
      if (response.ok) {
        trackEvent(MixpanelEvent.Auth_Admin_User_Create_Completed, {
          username_length: cleanedUsername.length,
          user_count_after: users.length + 1,
        });
        notify.success(t("admin.userCreated"), t("admin.userCanSignIn", { username: cleanedUsername }));
        setUsername("");
        setPassword("");
        await loadUsers("user_created");
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_Create_Failed, {
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotCreateUser"), detail);
      }
    } catch (createError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Create_Failed, {
        status_code: null,
        error_message: sanitizeAnalyticsError(
          createError,
          "Could not create user"
        ),
      });
      notify.error(t("admin.couldNotCreateUser"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const openResetPassword = (user: AdminUser) => {
    setResetPasswordValue("");
    setDialog({ kind: "reset-password", user });
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (dialog?.kind !== "reset-password") return;

    const { user } = dialog;
    setBusy(`reset:${user.id}`);
    trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Started, {
      target_role: user.role,
    });
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      if (response.ok) {
        trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Completed, {
          target_role: user.role,
          sessions_invalidated: true,
        });
        notify.success(t("admin.passwordReset"), t("admin.sessionsSignedOut"));
        setDialog(null);
        setResetPasswordValue("");
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Failed, {
          target_role: user.role,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotResetPassword"), detail);
      }
    } catch (resetError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Failed, {
        target_role: user.role,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          resetError,
          "Could not reset password"
        ),
      });
      notify.error(t("admin.couldNotResetPassword"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async () => {
    if (dialog?.kind !== "delete-user") return;

    const { user } = dialog;
    setBusy(`delete:${user.id}`);
    trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Started, {
      target_role: user.role,
      user_count_before: users.length,
    });
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Completed, {
          target_role: user.role,
          user_count_after: Math.max(0, users.length - 1),
        });
        notify.success(t("admin.userDeleted"), t("admin.userWorkspaceRemoved", { username: user.username }));
        setDialog(null);
        await loadUsers("user_deleted");
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Failed, {
          target_role: user.role,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotDeleteUser"), detail);
      }
    } catch (deleteError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Failed, {
        target_role: user.role,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          deleteError,
          "Could not delete user"
        ),
      });
      notify.error(t("admin.couldNotDeleteUser"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const createKey = async () => {
    setBusy("create-key");
    trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Started, {
      api_key_count_before: keys.length,
    });
    try {
      const response = await fetch("/api/v1/auth/token/create", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const key = (await response.json()) as ApiKey;
        setKeys((current) => [key, ...current]);
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Completed, {
          api_key_count_after: keys.length + 1,
        });
        try {
          await navigator.clipboard.writeText(key.token);
          notify.success(t("admin.apiKeyCreated"), t("admin.apiKeyCopiedToClipboard"));
        } catch {
          notify.success(t("admin.apiKeyCreated"), t("admin.useCopyButton"));
        }
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Failed, {
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotCreateApiKey"), detail);
      }
    } catch (createError) {
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Failed, {
        status_code: null,
        error_message: sanitizeAnalyticsError(
          createError,
          "Could not create API key"
        ),
      });
      notify.error(t("admin.couldNotCreateApiKey"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const revokeKey = async () => {
    if (dialog?.kind !== "revoke-key") return;

    const { key } = dialog;
    setBusy(`revoke:${key.token}`);
    trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Started, {
      api_key_count_before: keys.length,
    });
    try {
      const response = await fetch("/api/v1/auth/token/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key.token }),
      });
      if (response.ok) {
        setKeys((current) => current.filter((item) => item.token !== key.token));
        setVisibleKeys((current) => {
          const next = new Set(current);
          next.delete(key.token);
          return next;
        });
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Completed, {
          api_key_count_after: Math.max(0, keys.length - 1),
        });
        setDialog(null);
        notify.success(t("admin.apiKeyRevoked"));
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Failed, {
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("admin.couldNotRevokeApiKey"), detail);
      }
    } catch (revokeError) {
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Failed, {
        status_code: null,
        error_message: sanitizeAnalyticsError(
          revokeError,
          "Could not revoke API key"
        ),
      });
      notify.error(t("admin.couldNotRevokeApiKey"), t("admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const toggleKeyVisibility = (token: string) => {
    setVisibleKeys((current) => {
      const next = new Set(current);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  };

  const copyKey = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      notify.success(t("admin.apiKeyCopied"));
    } catch {
      notify.error(t("admin.couldNotCopyApiKey"), t("admin.tryAgain"));
    }
  };

  const dialogBusy =
    (dialog?.kind === "reset-password" && busy === `reset:${dialog.user.id}`) ||
    (dialog?.kind === "delete-user" && busy === `delete:${dialog.user.id}`) ||
    (dialog?.kind === "revoke-key" && busy === `revoke:${dialog.key.token}`);
  const RootElement = embedded ? "section" : "main";

  return (
    <RootElement
      className={
        embedded
          ? "h-[calc(100vh-104px)] overflow-y-auto pb-28 pr-6 font-syne"
          : "min-h-screen bg-white px-8 py-10 font-syne"
      }
    >
      <div className={embedded ? "max-w-5xl" : "mx-auto max-w-5xl"}>
        {!embedded ? (
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-unbounded text-[28px] font-normal tracking-[-0.84px] text-black">
              {t("admin.title")}
            </h1>
            <LanguageSelector />
          </div>
        ) : null}

        <div
          className={`rounded-[12px] bg-[#F9F8F8] p-7 ${
            embedded ? "" : "mt-7"
          }`}
        >
          <h2 className="text-sm font-semibold text-[#191919]">
            {t("admin.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6B7280]">
            {t("admin.description")}
          </p>

          <Tabs defaultValue="users" className="mt-6">
          <TabsList className="h-11 rounded-full border border-[#EDEEEF] bg-[#F9FAFB] p-1">
            <TabsTrigger
              value="users"
              className="h-9 rounded-full px-5 text-xs text-[#667085] shadow-none data-[state=active]:bg-white data-[state=active]:text-[#5146E5] data-[state=active]:shadow-sm"
            >
              {t("admin.users")}
            </TabsTrigger>
            <TabsTrigger
              value="keys"
              className="h-9 rounded-full px-5 text-xs text-[#667085] shadow-none data-[state=active]:bg-white data-[state=active]:text-[#5146E5] data-[state=active]:shadow-sm"
            >
              {t("admin.apiKeys")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6 space-y-5">
            <section className="rounded-[12px] border border-[#EDEEEF] bg-white p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F3FF]">
                  <UserPlus className="h-4 w-4 text-[#5146E5]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#101323]">{t("admin.addUser")}</h2>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {t("admin.addUserDescription")}
                  </p>
                </div>
              </div>
              <form onSubmit={addUser} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  aria-label={t("admin.username")}
                  className={inputClass}
                  placeholder={t("admin.username")}
                  minLength={3}
                  maxLength={128}
                  pattern="\S+"
                  title={t("admin.usernameNoSpaces")}
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value.replace(/\s/g, ""))
                  }
                  required
                  spellCheck={false}
                />
                <input
                  aria-label={t("admin.password")}
                  className={inputClass}
                  type="password"
                  placeholder={t("admin.passwordPlaceholder")}
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button type="submit" className={primaryButtonClass} disabled={busy === "add"}>
                  {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("admin.createUser")}
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-white">
              <div className="flex items-center justify-between border-b border-[#EDEEEF] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F3FF]">
                    <Users className="h-4 w-4 text-[#5146E5]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#101323]">{t("admin.accounts")}</h2>
                    <p className="mt-0.5 text-xs text-[#667085]">
                      {users.length} {users.length === 1 ? t("admin.account") : t("admin.accountsPlural")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t("admin.refreshAccounts")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-[#5146E5]"
                  onClick={() => void loadUsers("manual")}
                >
                  <RefreshCw className={`h-4 w-4 ${busy === "users" ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="divide-y divide-[#EDEEEF]">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#101323]">{user.username}</p>
                      <p className="mt-1 text-xs text-[#667085]">
                        {user.role === "admin" ? t("admin.administrator") : t("admin.user")}
                        {user.created_at
                          ? ` · ${new Date(user.created_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    {user.role === "user" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-9 rounded-full border border-[#EDEEEF] bg-white px-4 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                          onClick={() => openResetPassword(user)}
                          disabled={busy !== null}
                        >
                          {t("admin.resetPassword")}
                        </button>
                        <button
                          type="button"
                          aria-label={t("admin.deleteUserLabel", { username: user.username })}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FEE4E2] bg-white text-[#D92D20] transition hover:bg-[#FEF3F2]"
                          onClick={() => setDialog({ kind: "delete-user", user })}
                          disabled={busy !== null}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="keys" className="mt-6">
            <section className="overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDEEEF] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F3FF]">
                    <KeyRound className="h-4 w-4 text-[#5146E5]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#101323]">{t("admin.apiAndMcpKeys")}</h2>
                    <p className="mt-0.5 text-xs text-[#667085]">
                      {t("admin.apiKeysDescription")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void createKey()}
                  disabled={busy === "create-key"}
                >
                  {busy === "create-key" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("admin.createApiKey")}
                </button>
              </div>
              <div className="divide-y divide-[#EDEEEF]">
                {keys.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <KeyRound className="mx-auto h-6 w-6 text-[#B8B4C7]" />
                    <p className="mt-3 text-sm text-[#667085]">
                      {t("admin.noApiKeys")}
                    </p>
                  </div>
                )}
                {keys.map((key) => {
                  const isVisible = visibleKeys.has(key.token);
                  return (
                    <div
                      key={key.token}
                      className="flex flex-wrap items-center gap-3 px-6 py-4"
                    >
                      <div className="min-w-[220px] flex-1">
                        <code className="block truncate text-xs text-[#344054]">
                          {isVisible ? key.token : maskedKey(key.token)}
                        </code>
                        <p className="mt-1 text-[11px] text-[#98A2B3]">
                          {t("admin.createdDate", { date: new Date(key.created_at).toLocaleDateString() })}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={isVisible ? t("admin.hideApiKey") : t("admin.showApiKey")}
                        title={isVisible ? t("admin.hideApiKey") : t("admin.showApiKey")}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F4F3FF] hover:text-[#5146E5]"
                        onClick={() => toggleKeyVisibility(key.token)}
                      >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        aria-label={t("admin.copyApiKey")}
                        title={t("admin.copyApiKey")}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F4F3FF] hover:text-[#5146E5]"
                        onClick={() => void copyKey(key.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("admin.revokeApiKey")}
                        title={t("admin.revokeApiKey")}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FEE4E2] text-[#D92D20] transition hover:bg-[#FEF3F2]"
                        onClick={() => setDialog({ kind: "revoke-key", key })}
                        disabled={busy !== null}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) {
            setDialog(null);
            setResetPasswordValue("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-[440px] gap-0 rounded-[24px] border-0 bg-white p-0 font-syne shadow-[0_24px_80px_rgba(15,23,42,0.18)] [&>button]:hidden">
          {dialog?.kind === "reset-password" && (
            <form onSubmit={resetPassword}>
              <DialogHeader className="px-7 pb-5 pt-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F3FF]">
                  <LockKeyhole className="h-5 w-5 text-[#5146E5]" />
                </div>
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("admin.resetPassword")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("admin.resetPasswordDescription", { username: dialog.user.username })}
                </DialogDescription>
                <label className="pt-4 text-xs font-semibold text-[#344054]" htmlFor="reset-password">
                  {t("admin.newPassword")}
                </label>
                <input
                  id="reset-password"
                  autoFocus
                  className={inputClass}
                  type="password"
                  placeholder={t("admin.minimumPassword")}
                  minLength={8}
                  maxLength={128}
                  value={resetPasswordValue}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  required
                />
              </DialogHeader>
              <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("admin.cancel")}
                </button>
                <button type="submit" className={primaryButtonClass} disabled={dialogBusy}>
                  {dialogBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("admin.resetPassword")}
                </button>
              </DialogFooter>
            </form>
          )}

          {dialog?.kind === "delete-user" && (
            <>
              <DialogHeader className="px-7 pb-6 pt-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F2]">
                  <AlertTriangle className="h-5 w-5 text-[#D92D20]" />
                </div>
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("admin.deleteUserTitle", { username: dialog.user.username })}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("admin.deleteUserDescription")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#D92D20] px-5 text-xs font-semibold text-white transition hover:bg-[#B42318] disabled:opacity-60"
                  onClick={() => void deleteUser()}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("admin.deleteUser")}
                </button>
              </DialogFooter>
            </>
          )}

          {dialog?.kind === "revoke-key" && (
            <>
              <DialogHeader className="px-7 pb-6 pt-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F2]">
                  <AlertTriangle className="h-5 w-5 text-[#D92D20]" />
                </div>
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("admin.revokeApiKeyTitle")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("admin.revokeApiKeyDescription")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#D92D20] px-5 text-xs font-semibold text-white transition hover:bg-[#B42318] disabled:opacity-60"
                  onClick={() => void revokeKey()}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("admin.revokeApiKey")}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </RootElement>
  );
}
