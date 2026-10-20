import { Fragment, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayGroupLabel } from "@/lib/dateRanges";
import { EventCard } from "@/components/events/EventCard";
import { EventListSkeleton } from "@/components/events/EventCardSkeleton";
import { DEFAULT_FEED_DISPLAY, useSettings } from "@/hooks/useSettings";
import type { Event } from "@/hooks/useEvents";

interface EventGridProps {
  events: Event[];
  isLoading: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  pageLimit: number;
  /** Shown when loading has finished and there are no events. */
  empty: ReactNode;
  /** Insert a Today / Tomorrow / weekday header before each new day (date-ordered feeds). */
  groupByDate?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const MOBILE_COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;
const DESKTOP_COLS = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" } as const;

/** The event card grid with infinite scroll, shared by Discover and category pages. */
export function EventGrid({ events, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage, pageLimit, empty, groupByDate, isError, onRetry }: EventGridProps) {
  const { data: settings } = useSettings();
  const feedDisplay = settings?.feed_display ?? DEFAULT_FEED_DISPLAY;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver, events.length]);

  return (
    <div className={`p-4 grid gap-4 ${MOBILE_COLS[feedDisplay.mobileColumns]} ${DESKTOP_COLS[feedDisplay.desktopColumns]} min-h-[600px]`}>
      {isLoading ? (
        <EventListSkeleton count={4} />
      ) : isError && events.length === 0 ? (
        <div role="alert" className="col-span-full text-center py-16 space-y-3">
          <div className="text-5xl" aria-hidden="true">😕</div>
          <h3 className="text-lg font-semibold">Couldn't load events</h3>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
        </div>
      ) : events.length > 0 ? (
        <>
          {events.map((event, index) => {
            const label = groupByDate ? dayGroupLabel(event.start_time) : null;
            const previous = groupByDate && index > 0 ? dayGroupLabel(events[index - 1].start_time) : null;
            return (
              <Fragment key={event.id}>
                {label && label !== previous && (
                  <h2 className="col-span-full pt-2 text-base font-semibold text-foreground">{label}</h2>
                )}
                <div>
                  <EventCard
                    id={event.id}
                    slug={event.slug}
                    title={event.title}
                    description={event.description || undefined}
                    imageUrl={event.image_url || undefined}
                    startTime={new Date(event.start_time)}
                    venueName={event.venue?.name}
                    categories={event.event_categories?.map((ec) => ec.category)}
                    isFree={event.is_free || false}
                    pricingAtSite={event.pricing_at_site || false}
                    isLivestream={event.is_livestream || false}
                    priceMin={event.price_min || undefined}
                    priceMax={event.price_max || undefined}
                    isRecurring={event.is_recurring || false}
                  />
                </div>
              </Fragment>
            );
          })}

          <div ref={loadMoreRef} className="col-span-full flex justify-center py-6">
            {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {!hasNextPage && events.length > pageLimit && (
              <p className="text-sm text-muted-foreground">You've seen all events</p>
            )}
          </div>
        </>
      ) : (
        empty
      )}
    </div>
  );
}
