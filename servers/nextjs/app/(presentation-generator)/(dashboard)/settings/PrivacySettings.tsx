"use client";
import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { setTelemetryEnabled } from "@/utils/mixpanel";
import { Loader2 } from "lucide-react";

const PrivacySettings = () => {
  const [trackingEnabled, setTrackingEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/telemetry-status");
        const data = await res.json();
        setTrackingEnabled(data.telemetryEnabled);
      } catch {
        setTrackingEnabled(true);
      }
    }
    fetchStatus();
  }, []);

  const handleTrackingToggle = async (enabled: boolean) => {
    const prev = trackingEnabled;
    setTrackingEnabled(enabled);
    setTelemetryEnabled(enabled);
    setSaving(true);
    try {
      await fetch("/api/user-config", {
        method: "POST",
        body: JSON.stringify({
          DISABLE_ANONYMOUS_TRACKING: enabled ? undefined : "true",
        }),
      });
    } catch {
      setTrackingEnabled(prev);
      setTelemetryEnabled(prev ?? true);
    } finally {
      setSaving(false);
    }
  };

  if (trackingEnabled === null) {
    return (
      <div className="w-full bg-[#F9F8F8] p-7 rounded-[20px] flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-[#5146E5]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="bg-[#F9F8F8] p-7 rounded-[20px]">
        <h4 className="text-sm font-semibold text-[#191919] mb-1">
          Usage analytics
        </h4>
        <p className="text-xs text-[#6B7280] mb-6 leading-relaxed max-w-lg">
          Share anonymous usage data to help us improve Presenton. No personal information or presentation content is collected.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-[10px] bg-white border border-[#EDEEEF] p-4">
          <div>
            <label
              htmlFor="tracking-toggle"
              className="text-sm font-medium text-[#191919] cursor-pointer select-none block"
            >
              Share anonymous usage data
            </label>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {trackingEnabled
                ? "Anonymous usage data is being shared."
                : "Anonymous usage data is not being shared"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF]" />
            )}
            <Switch
              id="tracking-toggle"
              checked={trackingEnabled}
              onCheckedChange={handleTrackingToggle}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;
