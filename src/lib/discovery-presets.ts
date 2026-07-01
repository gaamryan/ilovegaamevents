export interface DiscoveryPreset {
  label: string;
  emoji: string;
  keywords: string[];
}

export const DISCOVERY_PRESETS: DiscoveryPreset[] = [
  { label: "Nerds & Gaming", emoji: "🎮", keywords: ["anime", "gaming tournament", "cosplay", "comic con", "esports", "video game"] },
  { label: "Comedy", emoji: "🎤", keywords: ["stand up comedy", "open mic comedy", "comedy show"] },
  { label: "Table Top", emoji: "🎲", keywords: ["board game", "dungeons and dragons", "magic the gathering", "warhammer", "tabletop"] },
  { label: "Music", emoji: "🎶", keywords: ["concert", "live music", "dj set", "festival"] },
  { label: "Food & Drink", emoji: "🍺", keywords: ["food festival", "beer festival", "wine tasting", "food truck"] },
  { label: "Arts", emoji: "🎨", keywords: ["art show", "gallery opening", "art walk"] },
];

export function presetToKeyword(preset: DiscoveryPreset): string {
  return preset.keywords.join(" OR ");
}
