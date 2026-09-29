import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `value` is a v4-shaped UUID, e.g. a raw `events.id`. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Builds a URL-safe, unique event slug mirroring the DB's `set_event_slug`
 * trigger format (`slugify(title)-shortid`). Passed explicitly at insert time
 * so the DB never has to backfill (its trigger only fires when slug is null).
 */
export function generateEventSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 10);
  return base ? `${base}-${suffix}` : suffix;
}
