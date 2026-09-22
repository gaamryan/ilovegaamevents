import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    useSettings,
    useUpdateSetting,
    DEFAULT_FEED_DISPLAY,
    DEFAULT_HERO_SLIDE_INTERVAL_MS,
    MIN_HERO_SLIDE_INTERVAL_MS,
    MAX_HERO_SLIDE_INTERVAL_MS,
} from "@/hooks/useSettings";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_IMPORT_TEMPLATE = `please organize and state the following:
Event Name
Event Start Date
Event Start Time
Event End Date
Event End Time
Location (street address, city, state, zipcode)
Address
Google Maps Link to Address
Host
Ticket Link
Description
Cost
Cover Image : please copy and paste the full url path to the cover image`;

export function SettingsTab() {
    const { data: settings, isLoading } = useSettings();
    const updateSetting = useUpdateSetting();

    const [limit, setLimit] = useState(20);
    const [heroSlideSeconds, setHeroSlideSeconds] = useState(DEFAULT_HERO_SLIDE_INTERVAL_MS / 1000);
    const [showAdmin, setShowAdmin] = useState(false);
    const [importTemplate, setImportTemplate] = useState(DEFAULT_IMPORT_TEMPLATE);
    const [gaMeasurementId, setGaMeasurementId] = useState("");
    const [gaVerifyStatus, setGaVerifyStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
    const [lookerStudioUrl, setLookerStudioUrl] = useState("");
    const [mobileColumns, setMobileColumns] = useState<1 | 2 | 3>(DEFAULT_FEED_DISPLAY.mobileColumns);
    const [desktopColumns, setDesktopColumns] = useState<1 | 2 | 3>(DEFAULT_FEED_DISPLAY.desktopColumns);

    useEffect(() => {
        if (settings?.pagination_limit?.value) {
            setLimit(settings.pagination_limit.value);
        }
        if (settings?.hero_slide_interval_ms) {
            setHeroSlideSeconds(Math.round(settings.hero_slide_interval_ms / 1000));
        }
        if (settings?.nav_visibility) {
            setShowAdmin(settings.nav_visibility.admin ?? false);
        }
        if (settings?.import_template) {
            setImportTemplate(settings.import_template);
        }
        if (settings?.ga_measurement_id) {
            setGaMeasurementId(settings.ga_measurement_id);
        }
        if (settings?.looker_studio_url) {
            setLookerStudioUrl(settings.looker_studio_url);
        }
        if (settings?.feed_display) {
            setMobileColumns(settings.feed_display.mobileColumns ?? DEFAULT_FEED_DISPLAY.mobileColumns);
            setDesktopColumns(settings.feed_display.desktopColumns ?? DEFAULT_FEED_DISPLAY.desktopColumns);
        }
    }, [settings]);

    const handleVerifyGA = () => {
        const id = gaMeasurementId.trim();
        if (!id) {
            setGaVerifyStatus("invalid");
            return;
        }
        const valid = /^G-[A-Z0-9]{6,12}$/i.test(id);
        setGaVerifyStatus("checking");
        setTimeout(() => {
            setGaVerifyStatus(valid ? "valid" : "invalid");
        }, 800);
    };

    const handleSave = () => {
        updateSetting.mutate({
            key: "pagination_limit",
            value: { value: parseInt(limit.toString()) }
        });
    };

    const handleSaveHeroInterval = () => {
        const clampedSeconds = Math.min(
            MAX_HERO_SLIDE_INTERVAL_MS / 1000,
            Math.max(MIN_HERO_SLIDE_INTERVAL_MS / 1000, heroSlideSeconds)
        );
        setHeroSlideSeconds(clampedSeconds);
        updateSetting.mutate({
            key: "hero_slide_interval_ms",
            value: clampedSeconds * 1000,
        });
    };

    const handleNavToggle = (tab: "admin", enabled: boolean) => {
        const current = settings?.nav_visibility || { admin: false };
        const updated = { ...current, [tab]: enabled };
        setShowAdmin(enabled);
        updateSetting.mutate({
            key: "nav_visibility",
            value: updated
        });
    };

    const handleSaveTemplate = () => {
        updateSetting.mutate({
            key: "import_template",
            value: importTemplate
        });
    };

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="max-w-xl space-y-8 p-4">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">General Settings</h3>

                <div className="space-y-2">
                    <Label htmlFor="pagination">Events per Page</Label>
                    <div className="flex gap-2">
                        <Input
                            id="pagination"
                            type="number"
                            min={1}
                            max={100}
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value))}
                            className="max-w-[150px]"
                        />
                        <Button onClick={handleSave} disabled={updateSetting.isPending}>
                            {updateSetting.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Number of events to load at once on the home page.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="hero-interval">Hero slideshow speed (seconds)</Label>
                    <div className="flex gap-2">
                        <Input
                            id="hero-interval"
                            type="number"
                            min={MIN_HERO_SLIDE_INTERVAL_MS / 1000}
                            max={MAX_HERO_SLIDE_INTERVAL_MS / 1000}
                            value={heroSlideSeconds}
                            onChange={(e) => setHeroSlideSeconds(parseInt(e.target.value))}
                            className="max-w-[150px]"
                        />
                        <Button onClick={handleSaveHeroInterval} disabled={updateSetting.isPending}>
                            {updateSetting.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        How long each "Don't Miss" hero slide stays on screen before auto-advancing ({MIN_HERO_SLIDE_INTERVAL_MS / 1000}–{MAX_HERO_SLIDE_INTERVAL_MS / 1000}s).
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Navigation Tabs</h3>
                <p className="text-sm text-muted-foreground">
                    Show or hide tabs in the bottom navigation bar.
                </p>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Admin</Label>
                            <p className="text-sm text-muted-foreground">Show admin tab in navigation</p>
                        </div>
                        <Switch checked={showAdmin} onCheckedChange={(v) => handleNavToggle("admin", v)} />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Import Template</h3>
                <p className="text-sm text-muted-foreground">
                    This text is copied to clipboard when clicking "Copy Template" in the import dialog.
                </p>
                <Textarea
                    value={importTemplate}
                    onChange={(e) => setImportTemplate(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                />
                <Button onClick={handleSaveTemplate} disabled={updateSetting.isPending}>
                    {updateSetting.isPending ? "Saving..." : "Save Template"}
                </Button>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Feed Display</h3>
                <p className="text-sm text-muted-foreground">
                    Choose how many event cards to show per row on mobile and desktop.
                </p>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Mobile Columns</Label>
                        <RadioGroup
                            value={String(mobileColumns)}
                            onValueChange={(v) => {
                                const val = Number(v) as 1 | 2 | 3;
                                setMobileColumns(val);
                                updateSetting.mutate({ key: "feed_display", value: { mobileColumns: val, desktopColumns } });
                            }}
                            className="flex gap-4"
                        >
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="flex items-center gap-1.5">
                                    <RadioGroupItem value={String(n)} id={`mobile-${n}`} />
                                    <Label htmlFor={`mobile-${n}`} className="cursor-pointer">{n}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label>Desktop Columns</Label>
                        <RadioGroup
                            value={String(desktopColumns)}
                            onValueChange={(v) => {
                                const val = Number(v) as 1 | 2 | 3;
                                setDesktopColumns(val);
                                updateSetting.mutate({ key: "feed_display", value: { mobileColumns, desktopColumns: val } });
                            }}
                            className="flex gap-4"
                        >
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="flex items-center gap-1.5">
                                    <RadioGroupItem value={String(n)} id={`desktop-${n}`} />
                                    <Label htmlFor={`desktop-${n}`} className="cursor-pointer">{n}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Site Analytics</h3>
                <p className="text-sm text-muted-foreground">
                    Connect Google Analytics to track visitor activity. Enter your GA4 Measurement ID (e.g. G-XXXXXXXXXX).
                </p>
                <div className="flex gap-2 items-center">
                    <Input
                        placeholder="G-XXXXXXXXXX"
                        value={gaMeasurementId}
                        onChange={(e) => { setGaMeasurementId(e.target.value); setGaVerifyStatus("idle"); }}
                        className="max-w-[250px]"
                    />
                    <Button
                        onClick={() => updateSetting.mutate({ key: "ga_measurement_id", value: gaMeasurementId })}
                        disabled={updateSetting.isPending}
                    >
                        {updateSetting.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleVerifyGA}
                        disabled={gaVerifyStatus === "checking"}
                    >
                        {gaVerifyStatus === "checking" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : gaVerifyStatus === "valid" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : gaVerifyStatus === "invalid" ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                            "Verify"
                        )}
                    </Button>
                </div>
                {gaVerifyStatus === "valid" && (
                    <p className="text-sm text-green-600">✓ Measurement ID format is valid.</p>
                )}
                {gaVerifyStatus === "invalid" && (
                    <p className="text-sm text-destructive">✗ Invalid format. Expected G-XXXXXXXXXX.</p>
                )}
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Analytics Dashboard Embed</h3>
                <p className="text-sm text-muted-foreground">
                    Paste a Looker Studio embed URL to display your analytics dashboard in the Analytics tab. 
                    <a href="https://lookerstudio.google.com" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 ml-1 hover:underline">
                        Create a report <ExternalLink className="h-3 w-3" />
                    </a>
                </p>
                <div className="flex gap-2">
                    <Input
                        placeholder="https://lookerstudio.google.com/embed/reporting/..."
                        value={lookerStudioUrl}
                        onChange={(e) => setLookerStudioUrl(e.target.value)}
                        className="flex-1"
                    />
                    <Button
                        onClick={() => updateSetting.mutate({ key: "looker_studio_url", value: lookerStudioUrl })}
                        disabled={updateSetting.isPending}
                    >
                        {updateSetting.isPending ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            <ImageMigrationSection />
        </div>
    );
}

function ImageMigrationSection() {
    const [migrating, setMigrating] = useState(false);
    const [result, setResult] = useState<{ migrated: number; failed: number; errors: string[] } | null>(null);

    const handleMigrate = async () => {
        setMigrating(true);
        setResult(null);
        try {
            const { data, error } = await supabase.functions.invoke("migrate-images", { method: "POST" });
            if (error) throw error;
            setResult(data);
            if (data.migrated > 0) {
                toast.success(`Migrated ${data.migrated} images to internal storage`);
            } else {
                toast.info("No external images to migrate");
            }
        } catch (err) {
            toast.error("Migration failed: " + (err as Error).message);
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Image Storage</h3>
            <p className="text-sm text-muted-foreground">
                Migrate external event images (Facebook, Eventbrite, etc.) to internal storage so they don't break when external links expire.
            </p>
            <Button onClick={handleMigrate} disabled={migrating} variant="outline" className="gap-2">
                {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {migrating ? "Migrating..." : "Migrate External Images"}
            </Button>
            {result && (
                <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                        ✓ {result.migrated} migrated · {result.failed} failed
                    </p>
                    {result.errors?.length > 0 && (
                        <details className="text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">View failures</summary>
                            <ul className="mt-1 space-y-0.5 text-xs pl-4 list-disc">
                                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}