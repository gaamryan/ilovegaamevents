import { useRef, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LazyImage } from "@/components/ui/LazyImage";

interface SimilarEventsProps {
  eventId: string;
  categoryIds: string[];
  venueId?: string | null;
}

function useSimilarEvents({ eventId, categoryIds, venueId }: SimilarEventsProps) {
  return useQuery({
    queryKey: ["events", "similar", eventId],
    queryFn: async () => {
      // Get events sharing categories
      let categoryEventIds: string[] = [];
      if (categoryIds.length > 0) {
        const { data: catEvents } = await supabase
          .from("event_categories")
          .select("event_id")
          .in("category_id", categoryIds)
          .neq("event_id", eventId);
        categoryEventIds = (catEvents || []).map((e) => e.event_id);
      }

      // Get events at same venue
      let venueEventIds: string[] = [];
      if (venueId) {
        const { data: venueEvents } = await supabase
          .from("events")
          .select("id")
          .eq("venue_id", venueId)
          .eq("status", "approved")
          .neq("id", eventId)
          .gte("start_time", new Date().toISOString())
          .limit(10);
        venueEventIds = (venueEvents || []).map((e) => e.id);
      }

      const allIds = [...new Set([...categoryEventIds, ...venueEventIds])];
      if (allIds.length === 0) return [];

      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, image_url, start_time, is_free, venue:venues(name), event_categories(category:categories(id, name, icon, color))")
        .in("id", allIds.slice(0, 20))
        .eq("status", "approved")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: categoryIds.length > 0 || !!venueId,
  });
}

export function SimilarEvents({ eventId, categoryIds, venueId }: SimilarEventsProps) {
  const { data: events, isLoading } = useSimilarEvents({ eventId, categoryIds, venueId });
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollRef.current?.scrollLeft ?? 0;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 5) hasDragged.current = true;
    scrollRef.current.scrollLeft = scrollStartX.current - dx;
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  };

  if (isLoading || !events || events.length === 0) return null;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-lg font-bold">Similar Events</h2>
        <div className="hidden sm:flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll("left")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll("right")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide select-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="flex-shrink-0 w-56 snap-start"
            onClick={() => { if (!hasDragged.current) navigate(`/events/${event.slug || event.id}`); }}
          >
            <div className="rounded-xl overflow-hidden cursor-pointer group border border-border bg-card hover:shadow-md transition-all duration-200">
              <div className="relative h-28 overflow-hidden">
                <LazyImage
                  src={event.image_url}
                  alt={event.title}
                  className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
                  fallback={<div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60" />}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {event.is_free && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                    Free
                  </span>
                )}
              </div>
              <div className="p-3 space-y-1.5">
                {event.event_categories?.[0]?.category && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: event.event_categories[0].category.color ? `${event.event_categories[0].category.color}20` : undefined,
                      color: event.event_categories[0].category.color || undefined,
                    }}
                  >
                    {event.event_categories[0].category.icon} {event.event_categories[0].category.name}
                  </span>
                )}
                <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{format(new Date(event.start_time), "MMM d • h:mm a")}</span>
                </div>
                {event.venue && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{event.venue.name}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
