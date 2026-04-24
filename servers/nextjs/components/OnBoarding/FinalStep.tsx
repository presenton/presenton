import { ArrowRight, PartyPopper } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { trackEvent, MixpanelEvent, setTelemetryEnabled } from "@/utils/mixpanel";
import { Switch } from '../ui/switch';
import confetti from 'canvas-confetti';

const CONFETTI_COLORS = ['#ff00c5', '#f3ff00', '#9500d0', '#00d2f2', '#00ea9b', '#ff7f36'];

function fireRealisticConfetti() {
    confetti({
        particleCount: 300,
        spread: 360,
        origin: { x: 0.5, y: 0.5 },
        colors: CONFETTI_COLORS,
        startVelocity: 60,
        scalar: 1.8,
        gravity: 0.6,
        ticks: 300,
        decay: 0.93,
        zIndex: 9999,
    });
}

const FinalStep = () => {
    const router = useRouter()
    const pathname = usePathname()
    const [trackingEnabled, setTrackingEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        fireRealisticConfetti();
    }, []);

    useEffect(() => {
        async function fetchStatus() {
            try {
                const res = await fetch('/api/telemetry-status');
                const data = await res.json();
                setTrackingEnabled(data.telemetryEnabled);
            } catch {
                setTrackingEnabled(true);
            }
        }
        fetchStatus();
    }, []);

    const handleTrackingToggle = useCallback(async (enabled: boolean) => {
        const prev = trackingEnabled;
        setTrackingEnabled(enabled);
        setTelemetryEnabled(enabled);
        try {
            await fetch('/api/user-config', {
                method: 'POST',
                body: JSON.stringify({
                    DISABLE_ANONYMOUS_TRACKING: enabled ? undefined : 'true',
                }),
            });
        } catch {
            setTrackingEnabled(prev);
            setTelemetryEnabled(prev ?? true);
        }
    }, [trackingEnabled]);

    const handleGoToDashboard = () => {
        trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/dashboard" });
        router.push('/dashboard')
    }
    const handleGoToUpload = () => {
        trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/upload" });
        router.push('/upload')
    }
    return (
        <div className='fixed top-0 left-0 w-full h-full flex flex-col items-center justify-center'>
            <div className='flex flex-col items-center justify-center'>

                <img src="/final_onboarding.png" alt="presenton" className='w-[118px] h-[98px]  object-contain' />
                <h1 className='text-black text-[30px] font-normal font-unbounded py-2.5'>Welcome on board!</h1>
                <p className='text-[#000000CC] text-xl font-normal font-syne'>You’re all set. Let’s create your first presentation.</p>

                {trackingEnabled !== null && (
                    <div className='flex items-center gap-3 mt-8 px-5 py-3.5 rounded-[10px] border border-[#EDEEEF] bg-white'>
                        <div>
                            <p className='text-sm font-medium text-[#191919] font-syne'>Usage analytics</p>
                            <p className='text-[11px] text-[#9CA3AF] font-syne leading-tight mt-0.5'>Help improve Presenton by sharing anonymous usage data.</p>
                        </div>
                        <Switch
                            checked={trackingEnabled}
                            onCheckedChange={handleTrackingToggle}
                            className='data-[state=checked]:bg-[#7C51F8]'
                        />
                    </div>
                )}

                <button onClick={handleGoToUpload} className='bg-[#7C51F8] px-[23px] mt-8 py-[15px]  rounded-[70px] text-white text-lg font-syne font-semibold'>My First Presentation 🚀</button>
                <button onClick={fireRealisticConfetti} className='mt-3 flex items-center gap-1.5 text-sm text-[#7A5AF8] font-syne font-medium hover:underline'>
                    <PartyPopper className='w-4 h-4' /> Celebrate again!
                </button>
            </div>
            <button onClick={handleGoToDashboard} className='absolute uppercase bottom-20 text-[#7A5AF8] flex items-center gap-2 right-10  text-xs font-normal font-syne'>Go to your dashboard <ArrowRight className='w-4 h-4 text-[#7A5AF8]' /></button>
        </div>
    )
}

export default FinalStep
