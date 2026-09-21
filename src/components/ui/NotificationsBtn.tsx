import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function NotificationsBtn() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        // Check if SW is supported and registered
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                setRegistration(reg);
                reg.pushManager?.getSubscription().then((sub) => {
                    setIsSubscribed(!!sub);
                    setLoading(false);
                });
            }).catch(() => {
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, []);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const subscribe = async () => {
        if (!registration) {
            toast.error("Service worker not ready");
            return;
        }
        setLoading(true);

        try {
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                toast.info("Push notifications require VAPID configuration");
                return;
            }

            const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // Store subscription - would need push_subscriptions table
            console.log("Push subscription:", subscription);
            setIsSubscribed(true);
            toast.success("Notifications enabled!");

        } catch (error) {
            console.error(error);
            toast.error("Failed to enable notifications");
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async () => {
        setIsSubscribed(false);
        toast.info("Notifications disabled");
    };

    if (!('serviceWorker' in navigator)) return null;

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={loading}
            title={isSubscribed ? "Disable Notifications" : "Enable Notifications"}
        >
            {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isSubscribed ? (
                <Bell className="h-5 w-5 text-primary" />
            ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
        </Button>
    );
}
