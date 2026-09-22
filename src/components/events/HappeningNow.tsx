import { useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { LazyImage } from "@/components/ui/LazyImage";

function useHappeningNowEvents() {
  return useQuery({
    queryKey: ["events", "happening-now"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, image_url, start_time, end_time, is_free, venue:venues(name), event_categories(category:categories(id, name, icon, color))")
        .eq("status", "approved")
        .lte("start_time", now)
        .gte("end_time", now)
        .order("start_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000, // refresh every minute
  });
}

export function HappeningNow() {
  const { data: events, isLoading } = useHappeningNowEvents();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    scrollRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  if (isLoading) return null; // Don't show skeleton for this optional section
  if (!events || events.length === 0) return null;

  return (
    <div className="relative py-6 overflow-hidden min-h-[280px]">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-destructive/5 via-background to-destructive/5" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 mb-4">
          <div className="flex items-center gap-2.5">
            {/* Pulsing LIVE indicator */}
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-destructive/40 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </div>
            <h2 className="text-lg font-bold">Happening Now</h2>
            <span className="text-xs font-semibold text-destructive-foreground bg-destructive px-2 py-0.5 rounded-full uppercase tracking-wide">
              Live
            </span>
          </div>
          <div className="hidden sm:flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll("left")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll("right")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cards */}
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className="flex-shrink-0 w-64 snap-start"
              onClick={() => { if (!hasDragged.current) navigate(`/events/${event.slug || event.id}`); }}
            >
              <div className="relative rounded-xl overflow-hidden cursor-pointer group border border-destructive/20 bg-card hover:border-destructive/40 transition-all duration-200 shadow-sm hover:shadow-md">
                {/* Image */}
                <div className="relative h-32 overflow-hidden">
                  <LazyImage
                    src={event.image_url}
                    alt={event.title}
                    className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
                    fallback={<div className="absolute inset-0 bg-gradient-to-br from-destructive to-destructive/60" />}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                  {/* Live badge on card */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground/60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive-foreground" />
                    </span>
                    LIVE
                  </div>

                  {event.is_free && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">Free</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3 space-y-1.5">
                  <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>Started {format(new Date(event.start_time), "h:mm a")}</span>
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
    </div>
  );
}
