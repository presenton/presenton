"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Trash2,
  UserPlus,
  Search,
  ShieldCheck,
  X,
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
import { copyTextToClipboard } from "@/utils/clipboard";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { APIKeysList, UsersList } from "./AdminAccessLists";
import AdminSelectPopover from "./AdminSelectPopover";
import type { AdminUser, ApiKey } from "./admin-types";
import styles from "./AdminPanel.module.css";

type ApiKeyCreated = ApiKey & { token: string };

type AdminDialog =
  | { kind: "reset-password"; user: AdminUser }
  | { kind: "delete-user"; user: AdminUser }
  | { kind: "revoke-key"; apiKey: ApiKey }
  | null;

type AdminPanelProps = {
  embedded?: boolean;
  onBackToSettings?: () => void;
};

async function errorDetail(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.detail === undefined
    ? `Request failed (${response.status})`
    : formatFastApiDetail(payload.detail);
}

const primaryButtonClass =
  `${styles.primaryButton} motion-press`;

const inputClass =
  styles.input;

export default function AdminPanel({ embedded = false, onBackToSettings }: AdminPanelProps) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyTokens, setApiKeyTokens] = useState<Record<string, string>>({});
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(() => new Set());
  const [apiKeyUserId, setApiKeyUserId] = useState("");
  const [apiKeyLabel, setApiKeyLabel] = useState("API client");
  const [apiKeyExpiryDays, setApiKeyExpiryDays] = useState(90);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AdminDialog>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("users");
  const [userSearch, setUserSearch] = useState("");
  const [keySearch, setKeySearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [showUserForm, setShowUserForm] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const usernameInput = useRef<HTMLInputElement>(null);
  const keyLabelInput = useRef<HTMLInputElement>(null);
  const createAction = useRef<HTMLButtonElement>(null);
  const dialogReturnFocus = useRef<HTMLButtonElement | null>(null);
  const [restoreCreateFocus, setRestoreCreateFocus] = useState(false);

  const loadUsers = useCallback(async (
    trigger: "initial" | "manual" | "user_created" | "user_deleted" = "initial"
  ) => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await fetch("/api/v1/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const loadedUsers = (await response.json()) as AdminUser[];
        setUsers(loadedUsers);
        setOwnerFilter((current) =>
          current === "all" || loadedUsers.some((user) => user.id === current)
            ? current
            : "all"
        );
        setApiKeyUserId((current) =>
          current && loadedUsers.some((user) => user.id === current)
            ? current
            : loadedUsers.find((user) => user.role === "admin")?.id ?? loadedUsers[0]?.id ?? ""
        );
        trackEvent(MixpanelEvent.Auth_Admin_User_List_Loaded, {
          trigger,
          user_count: loadedUsers.length,
        });
      } else {
        const detail = await errorDetail(response);
        setUsersError(`Users could not be loaded. ${detail}`);
        trackEvent(MixpanelEvent.Auth_Admin_User_List_Failed, {
          trigger,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("toast.loadUsersError"), detail);
      }
    } catch (loadError) {
      setUsersError("Users could not be loaded. Check your connection and try again.");
      trackEvent(MixpanelEvent.Auth_Admin_User_List_Failed, {
        trigger,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          loadError,
          "Could not load users"
        ),
      });
      notify.error(t("toast.loadUsersError"), t("toast.tryAgain"));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadApiKeys = useCallback(async () => {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const response = await fetch("/api/v1/admin/api-keys", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const loaded = (await response.json()) as ApiKey[];
        const active = loaded.filter((apiKey) => !apiKey.revoked_at);
        setApiKeys(active);
        const validIds = new Set(active.map((key) => key.id));
        setApiKeyTokens((current) => Object.fromEntries(
          Object.entries(current).filter(([id]) => validIds.has(id))
        ));
        setVisibleApiKeys((current) => new Set(
          [...current].filter((id) => validIds.has(id))
        ));
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_List_Loaded, {
          api_key_count: active.length,
        });
      } else {
        const detail = await errorDetail(response);
        setKeysError(`API keys could not be loaded. ${detail}`);
        notify.error(t("toast.loadKeysError"), detail);
      }
    } catch {
      setKeysError("API keys could not be loaded. Check your connection and try again.");
      notify.error(t("toast.loadKeysError"), t("toast.tryAgain"));
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    trackEvent(MixpanelEvent.Auth_Admin_Viewed, {
      embedded,
    });
    void Promise.all([loadUsers(), loadApiKeys()]);
  }, [embedded, loadApiKeys, loadUsers]);

  useEffect(() => {
    if (showUserForm && activeTab === "users") usernameInput.current?.focus();
    if (showKeyForm && activeTab === "keys") keyLabelInput.current?.focus();
  }, [showUserForm, showKeyForm, activeTab]);

  useEffect(() => {
    if (restoreCreateFocus && busy === null) {
      createAction.current?.focus({ preventScroll: true });
      setRestoreCreateFocus(false);
    }
  }, [restoreCreateFocus, busy]);

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
        notify.success(t("toast.userCreated"), t("toast.userCreatedBody", { username: cleanedUsername }));
        setUsername("");
        setPassword("");
        setShowPassword(false);
        setShowUserForm(false);
        setRestoreCreateFocus(true);
        setUserSearch("");
        setRoleFilter("all");
        await loadUsers("user_created");
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_Create_Failed, {
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("toast.createUserError"), detail);
      }
    } catch (createError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Create_Failed, {
        status_code: null,
        error_message: sanitizeAnalyticsError(
          createError,
          "Could not create user"
        ),
      });
      notify.error(t("toast.createUserError"), t("toast.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const openAdminDialog = (next: Exclude<AdminDialog, null>) => {
    const kind = next.kind === "revoke-key" ? "key" : "user";
    const id = next.kind === "revoke-key" ? next.apiKey.id : next.user.id;
    dialogReturnFocus.current = document.querySelector<HTMLButtonElement>(
      `button[data-admin-action-${kind}="${CSS.escape(id)}"]`
    );
    setDialog(next);
  };

  const openResetPassword = (user: AdminUser) => {
    setResetPasswordValue("");
    openAdminDialog({ kind: "reset-password", user });
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
        notify.success(t("toast.passwordReset"), t("toast.passwordResetBody"));
        setDialog(null);
        setResetPasswordValue("");
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Failed, {
          target_role: user.role,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("toast.resetError"), detail);
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
      notify.error(t("toast.resetError"), t("toast.tryAgain"));
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
        notify.success(t("toast.userDeleted"), t("toast.userDeletedBody", { username: user.username }));
        await loadUsers("user_deleted");
        await loadApiKeys();
        setDialog(null);
      } else {
        const detail = await errorDetail(response);
        trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Failed, {
          target_role: user.role,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("toast.deleteError"), detail);
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
      notify.error(t("toast.deleteError"), t("toast.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const createApiKey = async (event: FormEvent) => {
    event.preventDefault();
    if (usersLoading || busy === "create-api-key") return;
    if (!users.some((user) => user.id === apiKeyUserId)) {
      notify.error(t("toast.chooseUser"), t("toast.chooseUserBody"));
      document.getElementById("admin-key-user")?.focus();
      return;
    }
    if (!apiKeyLabel.trim()) {
      notify.error(t("toast.addKeyLabel"), t("toast.addKeyLabelBody"));
      keyLabelInput.current?.focus();
      return;
    }
    setBusy("create-api-key");
    trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Started, {
      api_key_count_before: apiKeys.length,
    });
    try {
      const response = await fetch("/api/v1/admin/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: apiKeyUserId,
          label: apiKeyLabel.trim(),
          expiry_days: apiKeyExpiryDays,
        }),
      });
      if (!response.ok) {
        notify.error(t("toast.keyCreateError"), await errorDetail(response));
        return;
      }
      const created = (await response.json()) as ApiKeyCreated;
      const { token, ...apiKey } = created;
      setApiKeys((current) => [apiKey, ...current]);
      setApiKeyTokens((current) => ({ ...current, [apiKey.id]: token }));
      setVisibleApiKeys((current) => new Set(current).add(apiKey.id));
      setShowKeyForm(false);
      setRestoreCreateFocus(true);
      setKeySearch("");
      setOwnerFilter("all");
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Completed, {
        api_key_count_after: apiKeys.length + 1,
      });
      try {
        await copyTextToClipboard(token);
        notify.success(t("toast.keyCreated"), t("toast.keyCreatedCopied"));
      } catch {
        notify.success(t("toast.keyCreated"), t("toast.keyCreatedVisible"));
      }
    } catch {
      notify.error(t("toast.keyCreateError"), t("toast.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const getApiKeyToken = async (apiKeyId: string) => {
    const cached = apiKeyTokens[apiKeyId];
    if (cached) return cached;
    const response = await fetch(
      `/api/v1/admin/api-keys/${apiKeyId}/token`,
      { cache: "no-store", credentials: "include" }
    );
    if (!response.ok) throw new Error(await errorDetail(response));
    const payload = (await response.json()) as { token: string };
    setApiKeyTokens((current) => ({ ...current, [apiKeyId]: payload.token }));
    return payload.token;
  };

  const toggleApiKeyVisibility = async (apiKeyId: string) => {
    if (visibleApiKeys.has(apiKeyId)) {
      setVisibleApiKeys((current) => {
        const next = new Set(current);
        next.delete(apiKeyId);
        return next;
      });
      return;
    }
    setBusy(`reveal-api-key:${apiKeyId}`);
    try {
      await getApiKeyToken(apiKeyId);
      setVisibleApiKeys((current) => new Set(current).add(apiKeyId));
    } catch (revealError) {
      notify.error(
        t("toast.keyRevealError"),
        revealError instanceof Error ? revealError.message : t("toast.tryAgain")
      );
    } finally {
      setBusy(null);
    }
  };

  const copyApiKey = async (apiKeyId: string) => {
    setBusy(`reveal-api-key:${apiKeyId}`);
    try {
      await copyTextToClipboard(await getApiKeyToken(apiKeyId));
      notify.success(t("toast.keyCopied"));
    } catch (copyError) {
      notify.error(
        t("toast.keyCopyError"),
        copyError instanceof Error ? copyError.message : t("toast.tryAgain")
      );
    } finally {
      setBusy(null);
    }
  };

  const revokeApiKey = async () => {
    if (dialog?.kind !== "revoke-key") return;
    const { apiKey } = dialog;
    setBusy(`revoke-api-key:${apiKey.id}`);
    trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Started, {
      api_key_count_before: apiKeys.length,
    });
    try {
      const response = await fetch(
        `/api/v1/admin/api-keys/${apiKey.id}/revoke`,
        { method: "POST", credentials: "include" }
      );
      if (!response.ok) {
        notify.error(t("toast.keyRevokeError"), await errorDetail(response));
        return;
      }
      const revoked = (await response.json()) as ApiKey;
      setApiKeys((current) =>
        current.filter((item) => item.id !== revoked.id)
      );
      setApiKeyTokens((current) => {
        const next = { ...current };
        delete next[apiKey.id];
        return next;
      });
      setVisibleApiKeys((current) => {
        const next = new Set(current);
        next.delete(apiKey.id);
        return next;
      });
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Completed, {
        api_key_count_after: Math.max(0, apiKeys.length - 1),
      });
      setDialog(null);
      notify.success(t("toast.keyRevoked"));
    } catch {
      notify.error(t("toast.keyRevokeError"), t("toast.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const dialogBusy =
    (dialog?.kind === "reset-password" && busy === `reset:${dialog.user.id}`) ||
    (dialog?.kind === "delete-user" && busy === `delete:${dialog.user.id}`) ||
    (dialog?.kind === "revoke-key" && busy === `revoke-api-key:${dialog.apiKey.id}`);
  const RootElement = embedded ? "section" : "main";
  const formOpen = activeTab === "users" ? showUserForm : showKeyForm;
  const userQuery = userSearch.trim().toLocaleLowerCase();
  const keyQuery = keySearch.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((user) =>
    user.username.toLocaleLowerCase().includes(userQuery) &&
    (roleFilter === "all" || user.role === roleFilter)
  );
  const filteredKeys = apiKeys.filter((key) => {
    const owner = users.find((user) => user.id === key.user_id)?.username ?? key.user_id;
    return `${key.label} ${owner}`.toLocaleLowerCase().includes(keyQuery) &&
      (ownerFilter === "all" || key.user_id === ownerFilter);
  });
  const userCount = usersLoading || usersError ? "—" : users.length;
  const keyCount = keysLoading || keysError ? "—" : apiKeys.length;
  const clearUserFilters = () => { setUserSearch(""); setRoleFilter("all"); };
  const clearKeyFilters = () => { setKeySearch(""); setOwnerFilter("all"); };

  return (
    <RootElement dir={dir} className={`${styles.root} ${embedded ? styles.embedded : styles.standalone}`}>
      <div className={styles.canvas}>
        {embedded && onBackToSettings && (
          <button type="button" className={styles.backButton} onClick={onBackToSettings}>
            <ArrowLeft size={15} aria-hidden="true" className="rtl:rotate-180" /> {t("backToSettings")}
          </button>
        )}
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>{t("heading")}</h1>
            <p className={styles.description}>{t("description")}</p>
          </div>
          <button
            ref={createAction}
            type="button"
            className={formOpen ? styles.secondaryButton : primaryButtonClass}
            disabled={busy !== null}
            aria-expanded={activeTab === "users" ? showUserForm : showKeyForm}
            aria-controls={activeTab === "users" ? "admin-create-user" : "admin-create-key"}
            onClick={() => activeTab === "users" ? setShowUserForm((open) => !open) : setShowKeyForm((open) => !open)}
          >
            {formOpen ? <X size={16} aria-hidden="true" /> : activeTab === "users" ? <UserPlus size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
            {formOpen ? t("cancel") : activeTab === "users" ? t("addUser") : t("generateApiKey")}
          </button>
        </header>

        <Tabs dir={dir} value={activeTab} onValueChange={setActiveTab} className={styles.sheet}>
          <TabsList aria-label={t("viewsAria")} className={styles.tabList}>
            <TabsTrigger value="users" className={styles.tabTrigger}>
              {t("tabs.users")} <span aria-hidden="true" className={styles.tabCount}>{userCount}</span>
            </TabsTrigger>
            <TabsTrigger value="keys" className={styles.tabTrigger}>
              {t("tabs.apiKeys")} <span aria-hidden="true" className={styles.tabCount}>{keyCount}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className={styles.tabContent}>
            {showUserForm && (
              <section id="admin-create-user" className={`${styles.createSection} motion-fade`} aria-labelledby="admin-create-user-title">
                <div className={styles.createHeading}>
                  <div>
                    <h3 id="admin-create-user-title">{t("createUser.title")}</h3>
                    <p>{t("createUser.description")}</p>
                  </div>
                  <button type="button" className={styles.iconButton} aria-label={t("createUser.closeAria")} disabled={busy === "add"} onClick={() => { setShowUserForm(false); createAction.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
                </div>
                <form dir={dir} onSubmit={addUser} className={styles.userForm}>
                  <div className={styles.field}>
                    <label htmlFor="admin-new-username">{t("createUser.username")}</label>
                    <input ref={usernameInput} id="admin-new-username" className={inputClass} placeholder={t("createUser.usernamePlaceholder")} minLength={3} maxLength={128} pattern={"\\S+"} title={t("createUser.usernameTitle")} value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} required spellCheck={false} autoComplete="off" disabled={busy === "add"} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="admin-new-password">{t("createUser.password")}</label>
                    <div className={styles.passwordField}>
                      <input id="admin-new-password" className={inputClass} type={showPassword ? "text" : "password"} placeholder={t("createUser.passwordPlaceholder")} minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required disabled={busy === "add"} />
                      <button type="button" aria-label={showPassword ? t("createUser.hidePassword") : t("createUser.showPassword")} onClick={() => setShowPassword((show) => !show)}>{showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
                    </div>
                  </div>
                  <button type="submit" className={primaryButtonClass} disabled={busy === "add"}>
                    {busy === "add" && <Loader2 className={styles.spinner} size={16} aria-hidden="true" />}
                    {busy === "add" ? t("createUser.creating") : t("createUser.submit")}
                  </button>
                </form>
                <p className={styles.formHint}>{t("createUser.hint")}</p>
              </section>
            )}
            <div className={styles.toolbar}>
              <div className={styles.filters}>
                <div className={styles.search}>
                  <Search size={16} aria-hidden="true" />
                  <input type="search" className={inputClass} aria-label={t("toolbar.searchUsers")} placeholder={t("toolbar.searchUsersPlaceholder")} value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
                </div>
                <AdminSelectPopover
                  label={t("toolbar.filterUsersRole")}
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={[
                    { value: "all", label: t("toolbar.allRoles") },
                    { value: "admin", label: t("toolbar.administrators") },
                    { value: "user", label: t("toolbar.users") },
                  ]}
                />
              </div>
              <button type="button" className={styles.iconButton} aria-label={t("toolbar.refreshAccounts")} title={t("toolbar.refreshAccounts")} disabled={usersLoading || busy !== null} onClick={() => void loadUsers("manual")}>
                <RefreshCw size={16} aria-hidden="true" className={usersLoading ? styles.spinner : styles.refreshIcon} />
              </button>
            </div>
            <UsersList users={filteredUsers} total={users.length} loading={usersLoading} error={usersError} busy={busy !== null} onRetry={() => void loadUsers("manual")} onResetPassword={openResetPassword} onDeleteUser={(user) => openAdminDialog({ kind: "delete-user", user })} onClearFilters={clearUserFilters} />
          </TabsContent>

          <TabsContent value="keys" className={styles.tabContent}>
            {showKeyForm && (
              <section id="admin-create-key" className={`${styles.createSection} motion-fade`} aria-labelledby="admin-create-key-title">
                <div className={styles.createHeading}>
                  <div>
                    <h3 id="admin-create-key-title">{t("createKey.title")}</h3>
                    <p>{t("createKey.description")}</p>
                  </div>
                  <button type="button" className={styles.iconButton} aria-label={t("createKey.closeAria")} disabled={busy === "create-api-key"} onClick={() => { setShowKeyForm(false); createAction.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
                </div>
                <form dir={dir} onSubmit={createApiKey} className={styles.keyForm}>
                  <div className={styles.field}>
                    <label htmlFor="admin-key-user">{t("createKey.user")}</label>
                    <AdminSelectPopover
                      id="admin-key-user"
                      label={t("createKey.userLabel")}
                      value={apiKeyUserId}
                      onChange={setApiKeyUserId}
                      options={users.map((user) => ({ value: user.id, label: `${user.username} (${user.role})` }))}
                      placeholder={usersLoading ? t("createKey.loadingUsers") : t("createKey.selectUser")}
                      searchable
                      searchLabel={t("createKey.findUser")}
                      emptyMessage={t("createKey.noUsers")}
                      fullWidth
                      required
                      disabled={usersLoading || busy === "create-api-key"}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="admin-key-label">{t("createKey.keyLabel")}</label>
                    <input ref={keyLabelInput} id="admin-key-label" aria-label={t("createKey.keyLabelAria")} className={inputClass} value={apiKeyLabel} onChange={(event) => setApiKeyLabel(event.target.value)} minLength={1} maxLength={120} placeholder={t("createKey.keyLabelPlaceholder")} required disabled={busy === "create-api-key"} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="admin-key-expiry">{t("createKey.expiresAfter")}</label>
                    <AdminSelectPopover
                      id="admin-key-expiry"
                      label={t("createKey.expiryLabel")}
                      value={String(apiKeyExpiryDays)}
                      onChange={(value) => setApiKeyExpiryDays(Number(value))}
                      options={[30, 90, 180, 365].map((days) => ({ value: String(days), label: t("createKey.days", { count: days }) }))}
                      fullWidth
                      required
                      disabled={busy === "create-api-key"}
                    />
                  </div>
                  <button type="submit" className={primaryButtonClass} disabled={busy === "create-api-key" || usersLoading || !apiKeyUserId || !apiKeyLabel.trim()}>
                    {busy === "create-api-key" && <Loader2 className={styles.spinner} size={16} aria-hidden="true" />}
                    {busy === "create-api-key" ? t("createKey.generating") : t("createKey.submit")}
                  </button>
                </form>
                <p className={styles.formHint}>{users.length === 0 ? t("createKey.hintNoUsers") : t("createKey.hint")}</p>
              </section>
            )}
            <div className={styles.toolbar}>
              <div className={styles.filters}>
                <div className={styles.search}>
                  <Search size={16} aria-hidden="true" />
                  <input type="search" className={inputClass} aria-label={t("toolbar.searchKeys")} placeholder={t("toolbar.searchKeysPlaceholder")} value={keySearch} onChange={(event) => setKeySearch(event.target.value)} />
                </div>
                <AdminSelectPopover
                  label={t("toolbar.filterKeysUser")}
                  value={ownerFilter}
                  onChange={setOwnerFilter}
                  searchable
                  searchLabel={t("createKey.findUser")}
                  emptyMessage={t("createKey.noUsers")}
                  options={[
                    { value: "all", label: t("toolbar.allUsers") },
                    ...users.map((user) => ({ value: user.id, label: user.username })),
                  ]}
                />
              </div>
              <button type="button" className={styles.iconButton} aria-label={t("toolbar.refreshKeys")} title={t("toolbar.refreshKeys")} disabled={keysLoading || busy !== null} onClick={() => void loadApiKeys()}>
                <RefreshCw size={16} aria-hidden="true" className={keysLoading ? styles.spinner : styles.refreshIcon} />
              </button>
            </div>
            <APIKeysList apiKeys={filteredKeys} users={users} total={apiKeys.length} loading={keysLoading} error={keysError} busy={busy} tokens={apiKeyTokens} visibleKeys={visibleApiKeys} onRetry={() => void loadApiKeys()} onReveal={(id) => void toggleApiKeyVisibility(id)} onCopy={(id) => void copyApiKey(id)} onRevoke={(apiKey) => openAdminDialog({ kind: "revoke-key", apiKey })} onClearFilters={clearKeyFilters} />
          </TabsContent>
        </Tabs>
        <p className={styles.scopeNote}><ShieldCheck size={15} aria-hidden="true" />{t("scopeNote")}</p>
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
        <DialogContent hideDefaultClose onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = dialogReturnFocus.current;
          (target?.isConnected ? target : createAction.current)?.focus();
        }} className={`${styles.dialog} w-[calc(100vw-32px)] max-w-[440px] gap-0 rounded-2xl border-0 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]`}>
          {dialog?.kind === "reset-password" && (
            <form onSubmit={resetPassword}>
              <DialogHeader className="px-7 pb-5 pt-7 text-start">
                <LockKeyhole aria-hidden="true" className="mb-3 h-6 w-6 text-[#656570]" />
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("dialog.resetTitle")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("dialog.resetBody", { username: dialog.user.username })}
                </DialogDescription>
                <label className="pt-4 text-xs font-semibold text-[#344054]" htmlFor="reset-password">
                  {t("dialog.newPassword")}
                </label>
                <input
                  id="reset-password"
                  autoFocus
                  className={inputClass}
                  type="password"
                  placeholder={t("dialog.minChars")}
                  minLength={8}
                  maxLength={128}
                  value={resetPasswordValue}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  required
                />
              </DialogHeader>
              <DialogFooter className="flex-row gap-3 border-t border-[#EAECF0] p-5 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("dialog.cancel")}
                </button>
                <button type="submit" className={primaryButtonClass} disabled={dialogBusy}>
                  {dialogBusy && <Loader2 className={`${styles.spinner} h-4 w-4`} aria-hidden="true" />}
                  {t("dialog.resetTitle")}
                </button>
              </DialogFooter>
            </form>
          )}

          {dialog?.kind === "delete-user" && (
            <>
              <DialogHeader className="px-7 pb-6 pt-7 text-start">
                <AlertTriangle aria-hidden="true" className="mb-3 h-6 w-6 text-[#B42318]" />
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("dialog.deleteTitle", { username: dialog.user.username })}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("dialog.deleteBody")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row gap-3 border-t border-[#EAECF0] p-5 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("dialog.cancel")}
                </button>
                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.dangerButton}`}
                  onClick={() => void deleteUser()}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? <Loader2 className={`${styles.spinner} h-4 w-4`} aria-hidden="true" /> : <Trash2 className="h-4 w-4" />}
                  {t("dialog.deleteUser")}
                </button>
              </DialogFooter>
            </>
          )}

          {dialog?.kind === "revoke-key" && (
            <>
              <DialogHeader className="px-7 pb-6 pt-7 text-start">
                <AlertTriangle aria-hidden="true" className="mb-3 h-6 w-6 text-[#B42318]" />
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("dialog.revokeTitle")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("dialog.revokeBody", { label: dialog.apiKey.label })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row gap-3 border-t border-[#EAECF0] p-5 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("dialog.cancel")}
                </button>
                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.dangerButton}`}
                  onClick={() => void revokeApiKey()}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? <Loader2 className={`${styles.spinner} h-4 w-4`} aria-hidden="true" /> : <Trash2 className="h-4 w-4" />}
                  {t("dialog.revokeKey")}
                </button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </RootElement>
  );
}
