"use client";
import { useEffect, useRef, useState } from "react";
import {
    Check,
    ChevronUp,
    Loader2,
    RefreshCw,
    Trash2,
    Crown,
    User,
    UserCheck,
} from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getApiUrl } from "@/utils/api";
import { Button } from "@/components/ui/button";

interface CodexConfigProps {
    codexModel: string;
    onInputChange: (value: string | boolean, field: string) => void;
}

type AuthStatus = "checking" | "unauthenticated" | "polling" | "authenticated";

interface StatusResponse {
    status: string;
    account_id?: string;
    username?: string;
    email?: string;
    is_pro?: boolean;
    detail?: string;
}

interface CodexModel {
    id: string;
    name: string;
}

const CHATGPT_MODELS: CodexModel[] = [
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.2-codex", name: "GPT-5.2-Codex" },
    { id: "gpt-5.1-codex-max", name: "GPT-5.1-Codex-Max" },
    { id: "gpt-5.4-mini", name: "GPT-5.4-Mini" },
    { id: "gpt-5.3-codex", name: "GPT-5.3-Codex" },
    { id: "gpt-5.2", name: "GPT-5.2" },
];

const DEFAULT_CODEX_MODEL = "gpt-5.2";

export default function CodexConfig({
    codexModel,
    onInputChange,
}: CodexConfigProps) {
    const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
    const [accountId, setAccountId] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [isPro, setIsPro] = useState<boolean | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState("");
    const [isExchanging, setIsExchanging] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [openModelSelect, setOpenModelSelect] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    useEffect(() => {
        checkCurrentAuthStatus();
        return () => stopPolling();
    }, []);

    const applyProfile = (data: Partial<StatusResponse>) => {
        setAccountId(data.account_id ?? null);
        setUsername(data.username ?? null);
        setEmail(data.email ?? null);
        setIsPro(typeof data.is_pro === "boolean" ? data.is_pro : null);
    };

    const checkCurrentAuthStatus = async () => {
        try {
            const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/status"));
            if (!res.ok) {
                setAuthStatus("unauthenticated");
                applyProfile({});
                return;
            }
            const data: StatusResponse = await res.json();
            if (data.status === "authenticated") {
                setAuthStatus("authenticated");
                applyProfile(data);
            } else {
                setAuthStatus("unauthenticated");
                applyProfile({});
            }
        } catch {
            setAuthStatus("unauthenticated");
            applyProfile({});
        }
    };

    const handleSignIn = async () => {
        try {
            const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/initiate"), {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to initiate auth");
            const data = await res.json();
            const { session_id, url } = data;

            setSessionId(session_id);
            setAuthStatus("polling");
            window.open(url, "_blank", "noopener,noreferrer");

            pollIntervalRef.current = setInterval(async () => {
                try {
                    const pollRes = await fetch(
                        getApiUrl(`/api/v1/ppt/codex/auth/status/${session_id}`)
                    );
                    if (!pollRes.ok) return;
                    const pollData: StatusResponse = await pollRes.json();

                    if (pollData.status === "success") {
                        stopPolling();
                        setAuthStatus("authenticated");
                        applyProfile(pollData);
                        setSessionId(null);
                        if (!codexModel) {
                            onInputChange(DEFAULT_CODEX_MODEL, "codex_model");
                        }
                        toast.success("Signed in to ChatGPT successfully");
                    } else if (pollData.status === "failed") {
                        stopPolling();
                        setAuthStatus("unauthenticated");
                        applyProfile({});
                        toast.error("Authentication failed. Please try again.");
                    }
                } catch {
                    // keep polling on transient errors
                }
            }, 2000);
        } catch (err) {
            toast.error("Failed to start sign-in flow");
            setAuthStatus("unauthenticated");
            applyProfile({});
        }
    };

    const handleManualExchange = async () => {
        if (!sessionId || !manualCode.trim()) return;
        setIsExchanging(true);
        try {
            const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/exchange"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, code: manualCode.trim() }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Exchange failed");
            }
            const data = await res.json();
            stopPolling();
            setAuthStatus("authenticated");
            applyProfile(data);
            setSessionId(null);
            setManualCode("");
            if (!codexModel) {
                onInputChange(DEFAULT_CODEX_MODEL, "codex_model");
            }
            toast.success("Signed in to ChatGPT successfully");
        } catch (err: any) {
            toast.error(err.message || "Code exchange failed");
        } finally {
            setIsExchanging(false);
        }
    };

    const handleCancelPolling = () => {
        stopPolling();
        setSessionId(null);
        setManualCode("");
        setAuthStatus("unauthenticated");
    };

    const handleSignOut = async () => {
        setIsLoggingOut(true);
        try {
            await fetch(getApiUrl("/api/v1/ppt/codex/auth/logout"), { method: "POST" });
            setAuthStatus("unauthenticated");
            applyProfile({});
            onInputChange("codex", "LLM");
            onInputChange('', "codex_model");
            toast.success("Signed out from ChatGPT");
        } catch {
            toast.error("Sign out failed");
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleRefreshToken = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/refresh"), {
                method: "POST",
            });
            if (!res.ok) throw new Error("Refresh failed");
            const data = await res.json();
            applyProfile(data);
            toast.success("Token refreshed successfully");
        } catch {
            toast.error("Token refresh failed. Please sign in again.");
            setAuthStatus("unauthenticated");
            applyProfile({});
        } finally {
            setIsRefreshing(false);
        }
    };

    if (authStatus === "checking") {
        return (
            <div className="flex items-center gap-2 py-3 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Checking status…</span>
            </div>
        );
    }

    if (authStatus === "polling") {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 py-2">
                    <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    <span className="text-sm text-gray-600">Waiting for sign-in…</span>
                    <button
                        onClick={handleCancelPolling}
                        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-auto"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-xs text-gray-400">
                        Paste redirect URL or code if not redirected automatically
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Paste URL or code…"
                            className="flex-1 px-2 py-2 outline-none border border-gray-300 rounded-lg text-xs focus:border-gray-400 transition-colors"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                        />
                        <button
                            onClick={handleManualExchange}
                            disabled={isExchanging || !manualCode.trim()}
                            className="px-3 py-2 bg-[#EDEEEF] hover:bg-[#E4E5E6] disabled:opacity-40 rounded-lg text-xs font-medium text-[#101323] transition-colors"
                        >
                            {isExchanging ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                "Submit"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (authStatus === "authenticated") {
        const planLabel = isPro === true ? "Pro" : isPro === false ? "Free" : "Unknown";

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-3  border border-[#EDEEEF] rounded-lg">
                    <UserCheck className="w-5 h-5 text-black shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                                {username || email || (accountId ? `Account ${accountId}` : "ChatGPT Account")}
                            </p>

                        </div>
                        {email && username && (
                            <p className="text-xs text-gray-500 truncate">{email}</p>
                        )}
                        {!email && accountId && (
                            <p className="text-xs text-gray-500 truncate">ID: {accountId}</p>
                        )}
                        <p className="text-xs text-gray-400">Signed in to ChatGPT</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        <button
                            onClick={handleRefreshToken}
                            disabled={isRefreshing}
                            title="Refresh token"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EDEEEF] hover:bg-[#E4E5E6] disabled:opacity-40 transition-colors"
                        >
                            {isRefreshing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            ) : (
                                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                            )}
                        </button>
                        <button
                            onClick={handleSignOut}
                            disabled={isLoggingOut}
                            title="Sign out"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EDEEEF] hover:bg-[#E4E5E6] disabled:opacity-40 transition-colors"
                        >
                            {isLoggingOut ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            ) : (
                                <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                            )}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select GPT Model
                    </label>
                    <Popover open={openModelSelect} onOpenChange={setOpenModelSelect}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openModelSelect}
                                className="w-full h-10 px-3 outline-none border border-gray-300 rounded-lg hover:border-gray-400 justify-between"
                            >
                                <span className="text-sm text-gray-900">
                                    {codexModel
                                        ? (CHATGPT_MODELS.find((m) => m.id === codexModel)?.name ?? codexModel)
                                        : "Select a model"}
                                </span>
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="p-0"
                            align="start"
                            style={{ width: "var(--radix-popover-trigger-width)" }}
                        >
                            <Command>
                                <CommandInput placeholder="Search models…" />
                                <CommandList>
                                    <CommandEmpty>No model found.</CommandEmpty>
                                    <CommandGroup>
                                        {CHATGPT_MODELS.map((model) => (
                                            <CommandItem
                                                key={model.id}
                                                value={model.id}
                                                onSelect={(value) => {
                                                    onInputChange(value, "codex_model");
                                                    setOpenModelSelect(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        codexModel === model.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <span className="text-sm text-gray-900">
                                                    {model.name}
                                                </span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleSignIn}
            className="mt-8 py-2.5 px-3.5 bg-[#EDEEEF] hover:bg-[#E4E5E6] rounded-[48px] text-xs font-semibold text-[#101323] transition-colors"
        >
            Sign in with ChatGPT
        </button>
    );
}
