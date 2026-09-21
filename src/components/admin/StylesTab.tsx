import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSettings, useUpdateSetting, DEFAULT_STYLES, type StyleSettings, type ColorOrGradient } from "@/hooks/useSettings";
import type { Json } from "@/integrations/supabase/types";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── HSL ↔ Hex helpers ──────────────────────────────────────────────
function hslStringToHex(hslStr: string): string {
    try {
        const parts = hslStr.trim().split(/[\s,]+/);
        const h = parseFloat(parts[0]) / 360;
        const s = parseFloat(parts[1]) / 100;
        const l = parseFloat(parts[2]) / 100;
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        let r: number, g: number, b: number;
        if (s === 0) { r = g = b = l; } else {
            const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p2 = 2 * l - q2;
            r = hue2rgb(p2, q2, h + 1 / 3);
            g = hue2rgb(p2, q2, h);
            b = hue2rgb(p2, q2, h - 1 / 3);
        }
        const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch { return "#3b82f6"; }
}

function hexToHslString(hex: string): string {
    try {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return "210 100% 45%";
        const r = parseInt(result[1], 16) / 255;
        const g = parseInt(result[2], 16) / 255;
        const b = parseInt(result[3], 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    } catch { return "210 100% 45%"; }
}

// ── Reusable UI pieces ──────────────────────────────────────────────

/** Color swatch with native picker + HSL text input */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm">{label}</Label>
            <div className="flex gap-2 items-center">
                <label className="relative w-8 h-8 rounded border flex-shrink-0 cursor-pointer overflow-hidden">
                    <input type="color" value={hslStringToHex(value)} onChange={(e) => onChange(hexToHslString(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="w-full h-full" style={{ backgroundColor: `hsl(${value})` }} />
                </label>
                <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-xs" />
            </div>
        </div>
    );
}

/** Color-or-gradient editor */
function ColorOrGradientField({ label, value, onChange }: { label: string; value: ColorOrGradient; onChange: (v: ColorOrGradient) => void }) {
    const update = <K extends keyof ColorOrGradient>(k: K, v: ColorOrGradient[K]) => onChange({ ...value, [k]: v });

    return (
        <div className="space-y-3 border border-border/60 rounded-lg p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{label}</Label>
                <Select value={value.mode} onValueChange={(v) => update("mode", v as "solid" | "gradient")}>
                    <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {value.mode === "solid" ? (
                <ColorField label="Color" value={value.color} onChange={(v) => update("color", v)} />
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <ColorField label="From" value={value.gradientFrom} onChange={(v) => update("gradientFrom", v)} />
                        <ColorField label="To" value={value.gradientTo} onChange={(v) => update("gradientTo", v)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Angle: {value.gradientAngle}°</Label>
                        <Slider value={[value.gradientAngle]} onValueChange={([v]) => update("gradientAngle", v)} min={0} max={360} step={5} />
                    </div>
                    {/* Preview stripe */}
                    <div className="h-6 rounded" style={{ background: `linear-gradient(${value.gradientAngle}deg, hsl(${value.gradientFrom}), hsl(${value.gradientTo}))` }} />
                </div>
            )}
        </div>
    );
}

// ── Defaults ────────────────────────────────────────────────────────
const DEFAULT_THEME = {
    colors: {
        primary: "190 95% 32%",
        secondary: "210 20% 93%",
        background: "210 25% 97%",
        foreground: "210 30% 8%",
        card: "0 0% 100%",
        accent: "190 90% 38%",
        border: "210 16% 88%"
    },
    radius: "1rem",
    fonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif" }
};

// ── Main Component ──────────────────────────────────────────────────
export function StylesTab() {
    const { data: settings, isLoading } = useSettings();
    const updateSetting = useUpdateSetting();
    const [theme, setTheme] = useState<any>(null);
    const [styles, setStyles] = useState<StyleSettings>(DEFAULT_STYLES);

    useEffect(() => {
        if (settings?.site_theme) setTheme(settings.site_theme);
        else if (!isLoading && settings) setTheme(DEFAULT_THEME);
    }, [settings, isLoading]);

    useEffect(() => {
        if (settings?.site_styles) setStyles({ ...DEFAULT_STYLES, ...settings.site_styles });
        else if (!isLoading && settings) setStyles(DEFAULT_STYLES);
    }, [settings, isLoading]);

    const handleColorChange = (key: string, value: string) => {
        setTheme((prev: any) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
    };

    const updateStyle = <K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) => {
        setStyles(prev => ({ ...prev, [key]: value }));
    };

    const saveAll = async () => {
        try {
            await updateSetting.mutateAsync({ key: "site_theme", value: theme as unknown as Json });
            await updateSetting.mutateAsync({ key: "site_styles", value: styles as unknown as Json });
        } catch { }
    };

    const resetDefaults = () => {
        setTheme(DEFAULT_THEME);
        setStyles(DEFAULT_STYLES);
        toast.info("Defaults restored (unsaved). Click Save to apply.");
    };

    if (isLoading || !theme) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="max-w-2xl space-y-8 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Theme & Styles</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetDefaults}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Reset
                    </Button>
                    <Button onClick={saveAll} disabled={updateSetting.isPending}>
                        {updateSetting.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            {/* ─── Brand Colors ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Brand Colors</h4>
                <p className="text-xs text-muted-foreground">Click swatches to pick, or type HSL like <code>190 95% 32%</code></p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: "primary", label: "Primary (Brand)" },
                        { key: "accent", label: "Accent" },
                        { key: "background", label: "Page Background" },
                        { key: "foreground", label: "Page Text" },
                        { key: "card", label: "Card Default" },
                        { key: "secondary", label: "Secondary" },
                        { key: "border", label: "Border" },
                    ].map(({ key, label }) => (
                        <ColorField key={key} label={label} value={theme.colors[key] || "0 0% 50%"} onChange={(v) => handleColorChange(key, v)} />
                    ))}
                </div>
            </div>

            {/* ─── Shape ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Shape</h4>
                <div className="space-y-2">
                    <Label>Border Radius</Label>
                    <Input value={theme.radius} onChange={(e) => setTheme((p: any) => ({ ...p, radius: e.target.value }))} placeholder="1rem" />
                </div>
            </div>

            {/* ─── Page Background ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Page Background</h4>
                <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select value={styles.backgroundMode} onValueChange={(v) => updateStyle("backgroundMode", v as StyleSettings["backgroundMode"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="solid">Solid Color</SelectItem>
                            <SelectItem value="gradient">Gradient</SelectItem>
                            <SelectItem value="parallax-icons">Parallax Game Icons</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {styles.backgroundMode === "solid" && (
                    <ColorField label="Background Color" value={styles.backgroundSolidColor} onChange={(v) => updateStyle("backgroundSolidColor", v)} />
                )}

                {styles.backgroundMode === "gradient" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <ColorField label="From" value={styles.backgroundGradientFrom} onChange={(v) => updateStyle("backgroundGradientFrom", v)} />
                            <ColorField label="To" value={styles.backgroundGradientTo} onChange={(v) => updateStyle("backgroundGradientTo", v)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Angle: {styles.backgroundGradientAngle}°</Label>
                            <Slider value={[styles.backgroundGradientAngle]} onValueChange={([v]) => updateStyle("backgroundGradientAngle", v)} min={0} max={360} step={5} />
                        </div>
                        <div className="h-6 rounded" style={{ background: `linear-gradient(${styles.backgroundGradientAngle}deg, hsl(${styles.backgroundGradientFrom}), hsl(${styles.backgroundGradientTo}))` }} />
                    </div>
                )}

                {styles.backgroundMode === "parallax-icons" && (
                    <div className="space-y-2">
                        <ColorField label="Base Color" value={styles.backgroundSolidColor} onChange={(v) => updateStyle("backgroundSolidColor", v)} />
                        <p className="text-xs text-muted-foreground">Subtle game icons scroll in the background</p>
                    </div>
                )}
            </div>

            {/* ─── Top Bar (Header) ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Top Bar (Header)</h4>
                <ColorOrGradientField label="Background" value={styles.topBarBg} onChange={(v) => updateStyle("topBarBg", v)} />
                <ColorField label="Text Color" value={styles.topBarTextColor} onChange={(v) => updateStyle("topBarTextColor", v)} />
                <div className="space-y-2">
                    <Label className="text-xs">Frosted Glass Blur: {styles.topBarBlur}px</Label>
                    <Slider value={[styles.topBarBlur]} onValueChange={([v]) => updateStyle("topBarBlur", v)} min={0} max={24} step={1} />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Opacity: {Math.round(styles.topBarOpacity * 100)}%</Label>
                    <Slider value={[styles.topBarOpacity * 100]} onValueChange={([v]) => updateStyle("topBarOpacity", v / 100)} min={10} max={100} step={5} />
                </div>
            </div>

            {/* ─── Bottom Navigation Bar ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Bottom Navigation Bar</h4>
                <ColorOrGradientField label="Background" value={styles.navBg} onChange={(v) => updateStyle("navBg", v)} />
                <ColorField label="Text / Icon Color" value={styles.navTextColor} onChange={(v) => updateStyle("navTextColor", v)} />
                <div className="space-y-2">
                    <Label className="text-xs">Frosted Glass Blur: {styles.navBlur}px</Label>
                    <Slider value={[styles.navBlur]} onValueChange={([v]) => updateStyle("navBlur", v)} min={0} max={24} step={1} />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Opacity: {Math.round(styles.navOpacity * 100)}%</Label>
                    <Slider value={[styles.navOpacity * 100]} onValueChange={([v]) => updateStyle("navOpacity", v / 100)} min={10} max={100} step={5} />
                </div>
            </div>

            {/* ─── Event Cards ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Event Cards</h4>
                <ColorOrGradientField label="Background" value={styles.cardBg} onChange={(v) => updateStyle("cardBg", v)} />
                <ColorField label="Text Color" value={styles.cardTextColor} onChange={(v) => updateStyle("cardTextColor", v)} />
                <div className="space-y-2">
                    <Label className="text-xs">Dark Overlay: {styles.cardDarkness}%</Label>
                    <Slider value={[styles.cardDarkness]} onValueChange={([v]) => updateStyle("cardDarkness", v)} min={0} max={60} step={1} />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Opacity: {Math.round(styles.cardOpacity * 100)}%</Label>
                    <Slider value={[styles.cardOpacity * 100]} onValueChange={([v]) => updateStyle("cardOpacity", v / 100)} min={10} max={100} step={5} />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Frosted Glass Blur: {styles.cardBlur}px</Label>
                    <Slider value={[styles.cardBlur]} onValueChange={([v]) => updateStyle("cardBlur", v)} min={0} max={24} step={1} />
                </div>
            </div>

            {/* ─── Input Fields ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Input Fields</h4>
                <ColorOrGradientField label="Background" value={styles.inputBg} onChange={(v) => updateStyle("inputBg", v)} />
                <ColorField label="Text Color" value={styles.inputTextColor} onChange={(v) => updateStyle("inputTextColor", v)} />
            </div>

            {/* ─── Buttons ─── */}
            <div className="space-y-4 border p-4 rounded-lg bg-card">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Buttons</h4>

                <p className="text-xs text-muted-foreground font-medium mt-2">Default / Primary</p>
                <ColorOrGradientField label="Background" value={styles.btnDefaultBg} onChange={(v) => updateStyle("btnDefaultBg", v)} />
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Text" value={styles.btnDefaultText} onChange={(v) => updateStyle("btnDefaultText", v)} />
                    <ColorField label="Hover Background" value={styles.btnDefaultHoverBg} onChange={(v) => updateStyle("btnDefaultHoverBg", v)} />
                </div>

                <p className="text-xs text-muted-foreground font-medium mt-4">Outline / Secondary</p>
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Border" value={styles.btnOutlineBorder} onChange={(v) => updateStyle("btnOutlineBorder", v)} />
                    <ColorField label="Text" value={styles.btnOutlineText} onChange={(v) => updateStyle("btnOutlineText", v)} />
                </div>
                <ColorField label="Hover Background" value={styles.btnOutlineHoverBg} onChange={(v) => updateStyle("btnOutlineHoverBg", v)} />

                <p className="text-xs text-muted-foreground font-medium mt-4">Destructive</p>
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Background" value={styles.btnDestructiveBg} onChange={(v) => updateStyle("btnDestructiveBg", v)} />
                    <ColorField label="Text" value={styles.btnDestructiveText} onChange={(v) => updateStyle("btnDestructiveText", v)} />
                </div>
            </div>

            {/* ─── Live Preview ─── */}
            <div className="border p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Live Preview</h4>
                <div
                    className="rounded-xl p-4 border"
                    style={{
                        background: styles.cardBg.mode === "gradient"
                            ? `linear-gradient(${styles.cardBg.gradientAngle}deg, hsl(${styles.cardBg.gradientFrom}), hsl(${styles.cardBg.gradientTo}))`
                            : `hsl(${styles.cardBg.color} / ${styles.cardOpacity})`,
                        color: `hsl(${styles.cardTextColor})`,
                        backdropFilter: `blur(${styles.cardBlur}px)`,
                    }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg" style={{ background: `hsl(${theme.colors.primary})` }} />
                        <div>
                            <div className="font-semibold">Sample Event Card</div>
                            <div className="text-sm opacity-70">Preview of card styling</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1.5 rounded-md text-sm font-medium"
                            style={{
                                background: styles.btnDefaultBg.mode === "gradient"
                                    ? `linear-gradient(${styles.btnDefaultBg.gradientAngle}deg, hsl(${styles.btnDefaultBg.gradientFrom}), hsl(${styles.btnDefaultBg.gradientTo}))`
                                    : `hsl(${styles.btnDefaultBg.color})`,
                                color: `hsl(${styles.btnDefaultText})`,
                            }}
                        >
                            Primary
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-md text-sm font-medium border"
                            style={{
                                borderColor: `hsl(${styles.btnOutlineBorder})`,
                                color: `hsl(${styles.btnOutlineText})`,
                            }}
                        >
                            Outline
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-md text-sm font-medium"
                            style={{
                                background: `hsl(${styles.btnDestructiveBg})`,
                                color: `hsl(${styles.btnDestructiveText})`,
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}