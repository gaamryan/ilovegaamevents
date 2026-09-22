import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyImage } from "@/components/ui/LazyImage";
import {
  useFeaturedEventsForOrdering,
  useReorderFeaturedEvents,
  type FeaturedOrderEvent,
} from "@/hooks/useEvents";

export function FeaturedEventsOrder() {
  const { data: events, isLoading } = useFeaturedEventsForOrdering();
  const reorder = useReorderFeaturedEvents();
  const [ordered, setOrdered] = useState<FeaturedOrderEvent[]>([]);

  useEffect(() => {
    if (events) setOrdered(events);
  }, [events]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setOrdered(next);
    reorder.mutate(next.map((e) => e.id));
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4 p-4">
      <div>
        <h3 className="text-lg font-medium">Homepage Hero Order</h3>
        <p className="text-sm text-muted-foreground">
          Sets the order events appear in the "Don't Miss" hero carousel on the homepage. Only
          the top 3 are shown there; this list is everything currently marked Featured that
          hasn't ended yet — events drop off this list (and the hero) automatically once they're
          over.
        </p>
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No upcoming events are marked Featured yet. Toggle "Featured event" in an event's edit
          panel to add one here.
        </p>
      ) : (
        <div className="space-y-2">
          {ordered.map((event, index) => (
            <div
              key={event.id}
              className="flex items-center gap-3 p-2 rounded-xl border border-border bg-card"
            >
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${event.title} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === ordered.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${event.title} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                <LazyImage
                  src={event.image_url}
                  alt=""
                  className="w-full h-full"
                  fallback={<div className="w-full h-full bg-gradient-primary opacity-20" />}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(event.start_time), "EEE, MMM d • h:mm a")}
                </p>
              </div>

              {index < 3 && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                  <Star className="h-3 w-3 fill-current" />
                  In hero
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
