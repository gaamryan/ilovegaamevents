import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

export interface ColorOrGradient {
    mode: "solid" | "gradient";
    color: string;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
}

export interface StyleSettings {
    backgroundMode: "solid" | "gradient" | "parallax-icons";
    backgroundSolidColor: string;
    backgroundGradientFrom: string;
    backgroundGradientTo: string;
    backgroundGradientAngle: number;
    // Top Bar
    topBarBg: ColorOrGradient;
    topBarTextColor: string;
    topBarBlur: number;
    topBarOpacity: number;
    // Bottom Nav
    navBlur: number;
    navOpacity: number;
    navBg: ColorOrGradient;
    navTextColor: string;
    // Cards
    cardDarkness: number;
    cardOpacity: number;
    cardBlur: number;
    cardBg: ColorOrGradient;
    cardTextColor: string;
    // Inputs
    inputBg: ColorOrGradient;
    inputTextColor: string;
    // Buttons
    btnDefaultBg: ColorOrGradient;
    btnDefaultText: string;
    btnDefaultHoverBg: string;
    btnOutlineBorder: string;
    btnOutlineText: string;
    btnOutlineHoverBg: string;
    btnDestructiveBg: string;
    btnDestructiveText: string;
}

export interface FeedDisplaySettings {
    mobileColumns: 1 | 2 | 3;
    desktopColumns: 1 | 2 | 3;
}

export const DEFAULT_FEED_DISPLAY: FeedDisplaySettings = {
    mobileColumns: 1,
    desktopColumns: 2,
};

// Bounds match the admin field (SettingsTab) — shown there in seconds.
export const DEFAULT_HERO_SLIDE_INTERVAL_MS = 6000;
export const MIN_HERO_SLIDE_INTERVAL_MS = 3000;
export const MAX_HERO_SLIDE_INTERVAL_MS = 20000;

export interface SiteTheme {
    colors: {
        primary: string;
        secondary: string;
        background: string;
        foreground: string;
        card: string;
        accent: string;
        border: string;
    };
    radius: string;
    fonts: {
        heading: string;
        body: string;
    };
}

export interface Settings {
    pagination_limit?: { value: number };
    nav_visibility?: {
        admin: boolean;
    };
    import_template?: string;
    feed_display?: FeedDisplaySettings;
    site_theme?: SiteTheme;
    site_styles?: StyleSettings;
    ga_measurement_id?: string;
    looker_studio_url?: string;
    hero_slide_interval_ms?: number;
    [key: string]: unknown;
}

const defaultCog = (color: string): ColorOrGradient => ({
    mode: "solid", color, gradientFrom: color, gradientTo: color, gradientAngle: 135,
});

export const DEFAULT_STYLES: StyleSettings = {
    backgroundMode: "solid",
    backgroundSolidColor: "210 25% 97%",
    backgroundGradientFrom: "210 30% 6%",
    backgroundGradientTo: "190 95% 32%",
    backgroundGradientAngle: 135,
    topBarBg: defaultCog("0 0% 100%"),
    topBarTextColor: "210 30% 8%",
    topBarBlur: 12,
    topBarOpacity: 0.95,
    navBlur: 12,
    navOpacity: 0.85,
    navBg: defaultCog("0 0% 100%"),
    navTextColor: "210 12% 40%",
    cardDarkness: 0,
    cardOpacity: 1,
    cardBlur: 0,
    cardBg: defaultCog("0 0% 100%"),
    cardTextColor: "210 30% 8%",
    inputBg: defaultCog("0 0% 100%"),
    inputTextColor: "210 30% 8%",
    btnDefaultBg: defaultCog("190 95% 32%"),
    btnDefaultText: "0 0% 100%",
    btnDefaultHoverBg: "190 95% 28%",
    btnOutlineBorder: "210 16% 88%",
    btnOutlineText: "210 30% 8%",
    btnOutlineHoverBg: "210 20% 95%",
    btnDestructiveBg: "0 84% 60%",
    btnDestructiveText: "0 0% 100%",
};

export function useSettings() {
    return useQuery({
        queryKey: ["settings"],
        queryFn: async () => {
            const { data, error } = await supabase.from("settings").select("key, value");
            if (error) throw error;

            const settingsObject: Settings = {};
            data.forEach((item) => {
                settingsObject[item.key] = item.value;
            });
            return settingsObject;
        },
        staleTime: 10 * 60 * 1000, // settings rarely change — 10 min
    });
}

export function useUpdateSetting() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ key, value }: { key: string; value: Json }) => {
            const { error } = await supabase.from("settings")
                .upsert({ key, value });
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            toast.success(`Updated ${variables.key.replace('_', ' ')}`);
        },
        onError: (error) => {
            console.error("Failed to update setting:", error);
            toast.error("Failed to update setting");
        },
    });
}