import { useRef, useEffect, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useFeaturedEvents } from "@/hooks/useEvents";
import {
  useSettings,
  DEFAULT_HERO_SLIDE_INTERVAL_MS,
  MIN_HERO_SLIDE_INTERVAL_MS,
  MAX_HERO_SLIDE_INTERVAL_MS,
} from "@/hooks/useSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { LazyImage } from "@/components/ui/LazyImage";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD_PX = 40;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function FeaturedEvents() {
  const { data: events, isLoading } = useFeaturedEvents();
  const { data: settings } = useSettings();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = events?.length ?? 0;
  const isPaused = isHovered || isFocused;

  const intervalMs = Math.min(
    MAX_HERO_SLIDE_INTERVAL_MS,
    Math.max(MIN_HERO_SLIDE_INTERVAL_MS, settings?.hero_slide_interval_ms ?? DEFAULT_HERO_SLIDE_INTERVAL_MS)
  );

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      setActiveIndex(((index % count) + count) % count);
    },
    [count]
  );
  const goNext = useCallback(() => goTo(activeIndex + 1), [goTo, activeIndex]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [goTo, activeIndex]);

  // If the featured list shrinks (e.g. a background refetch), don't get stuck
  // pointing past the end of it.
  useEffect(() => {
    if (count > 0 && activeIndex >= count) setActiveIndex(0);
  }, [count, activeIndex]);

  // Auto-advance — paused on hover/focus, off entirely for reduced motion.
  useEffect(() => {
    if (prefersReducedMotion || isPaused || count <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [prefersReducedMotion, isPaused, count, intervalMs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_THRESHOLD_PX) goPrev();
    else if (dx < -SWIPE_THRESHOLD_PX) goNext();
  };

  // JS-tracked focus-within: only resume autoplay once focus has actually
  // left the whole region, not just moved between elements inside it.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFocused(false);
  };

  if (isLoading) {
    return (
      <div className="relative py-8 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10" />
        <div className="relative">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <Skeleton className="w-full aspect-video md:aspect-[21/9] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="relative py-8 overflow-hidden">
      {/* Unique background to differentiate from rest of page */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/8" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, hsl(var(--primary)) 1px, transparent 1px),
                            radial-gradient(circle at 80% 20%, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="px-4 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Don't Miss</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-10">Hand-picked events just for you</p>
        </div>

        <div
          className="relative mx-4 rounded-2xl overflow-hidden border border-border/50 bg-card shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured events"
          tabIndex={0}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Slides — all mounted at once (grid-overlapped, not absolutely
              positioned) so the container auto-sizes to the tallest slide
              instead of a guessed fixed height, images preload up front,
              and nothing has to mount/unmount to crossfade. */}
          <div className="grid" aria-live={isPaused ? "polite" : "off"}>
            {events.map((event, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={event.id}
                  className={cn(
                    "col-start-1 row-start-1 grid grid-cols-1 md:grid-cols-[3fr_2fr]",
                    prefersReducedMotion ? "" : "transition-opacity duration-700",
                    isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                  )}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${events.length}`}
                  aria-hidden={!isActive}
                >
                  {/* Image — full flyer shown via object-contain, over a
                      blurred/darkened object-cover copy filling the frame. */}
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    <LazyImage
                      src={event.image_url}
                      alt=""
                      className="absolute inset-0 scale-110 blur-2xl"
                      objectFit="cover"
                      fallback={<div className="absolute inset-0 bg-gradient-primary" />}
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <LazyImage
                      src={event.image_url}
                      alt={event.title}
                      className="absolute inset-0"
                      objectFit="contain"
                      fallback={<div className="absolute inset-0 bg-gradient-primary opacity-20" />}
                    />
                  </div>

                  {/* Details panel */}
                  <div
                    className={cn(
                      "flex flex-col justify-center gap-3 p-5 md:p-6 md:pr-20 min-h-[280px] md:min-h-0",
                      prefersReducedMotion ? "" : "transition-opacity duration-500"
                    )}
                    style={{ transitionDelay: isActive ? "150ms" : "0ms" }}
                  >
                    <span className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-md w-fit">
                      <Sparkles className="h-3 w-3" />
                      Staff Pick
                    </span>

                    {event.event_categories && event.event_categories.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {event.event_categories.slice(0, 3).map((ec) => (
                          <span
                            key={ec.category.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: ec.category.color ? `${ec.category.color}20` : undefined,
                              color: ec.category.color || undefined,
                            }}
                          >
                            {ec.category.icon && <span className="text-xs">{ec.category.icon}</span>}
                            {ec.category.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <h3 className="font-bold text-xl md:text-2xl leading-snug">{event.title}</h3>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0 text-primary/70" />
                        <span>{format(new Date(event.start_time), "EEE, MMM d • h:mm a")}</span>
                      </div>
                      {event.venue && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-primary/70" />
                          <span className="truncate">{event.venue.name}</span>
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {event.description.replace(/<[^>]*>/g, "")}
                      </p>
                    )}

                    <Button asChild className="w-fit mt-1" tabIndex={isActive ? 0 : -1}>
                      <Link to={`/events/${event.slug || event.id}`}>View details</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Arrows — desktop only; positioned over the details panel */}
          {events.length > 1 && (
            <div className="hidden md:flex absolute top-5 right-5 z-20 gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm"
                onClick={goPrev}
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm"
                onClick={goNext}
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {events.length > 1 && (
          <div className="flex justify-center gap-1.5 pt-4">
            {events.map((_, i) => (
              <button
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === activeIndex ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-primary/25"
                )}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
