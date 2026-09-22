import { useRef, useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Calendar, MapPin, MoveRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useFeaturedEvents } from "@/hooks/useEvents";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { LazyImage } from "@/components/ui/LazyImage";

export function FeaturedEvents() {
  const { data: events, isLoading } = useFeaturedEvents();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isDragging, setIsDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasDragged = useRef(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  // Show swipe hint on first visit
  useEffect(() => {
    if (!events || events.length <= 1) return;
    const key = "featured_swipe_hint_seen";
    if (!localStorage.getItem(key)) {
      setShowSwipeHint(true);
      localStorage.setItem(key, "1");
      const timer = setTimeout(() => setShowSwipeHint(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [events]);

  // Track active dot based on scroll position
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const cardWidth = 320 + 16; // w-80 + gap-4
      const index = Math.round(container.scrollLeft / cardWidth);
      setActiveIndex(index);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [events]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Auto-rotate on mobile
  useEffect(() => {
    if (!isMobile || !events || events.length <= 1) return;
    const container = scrollRef.current;
    if (!container) return;

    const interval = setInterval(() => {
      if (isDragging) return;
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: 340, behavior: "smooth" });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isMobile, events, isDragging]);

  // Mouse drag handlers
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

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (isLoading) {
    return (
      <div className="relative py-8 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10" />
        <div className="relative">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="flex-shrink-0 w-80 h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="relative py-8 overflow-hidden min-h-[340px]">
      {/* Unique background to differentiate from rest of page */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/8" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, hsl(var(--primary)) 1px, transparent 1px),
                          radial-gradient(circle at 80% 20%, hsl(var(--primary)) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Don't Miss</h2>
            </div>
            <p className="text-sm text-muted-foreground ml-10">Hand-picked events just for you</p>
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
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide select-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.12, type: "spring", stiffness: 200 }}
              className="flex-shrink-0 w-80 snap-start"
              onClick={() => { if (!hasDragged.current) navigate(`/events/${event.slug || event.id}`); }}
            >
              <div className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card border border-border/50">
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  <LazyImage
                    src={event.image_url}
                    alt={event.title}
                    className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
                    fallback={<div className="absolute inset-0 bg-gradient-primary" />}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Featured Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-md">
                      <Sparkles className="h-3 w-3" />
                      Staff Pick
                    </span>
                  </div>

                  {/* Price */}
                  {event.is_free && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                        Free
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  {/* Categories */}
                  {event.event_categories && event.event_categories.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {event.event_categories.slice(0, 2).map((ec) => (
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

                  <h3 className="font-bold text-base line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {event.title}
                  </h3>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
                      <span>{format(new Date(event.start_time), "EEE, MMM d • h:mm a")}</span>
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
                        <span className="truncate">{event.venue.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          </div>

          {/* Swipe hint overlay */}
          <AnimatePresence>
            {showSwipeHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              >
                <div className="bg-foreground/70 backdrop-blur-sm text-background rounded-full px-5 py-2.5 flex items-center gap-2 shadow-lg">
                  <motion.div
                    animate={{ x: [0, 12, 0] }}
                    transition={{ repeat: 2, duration: 0.8, ease: "easeInOut" }}
                  >
                    <MoveRight className="h-4 w-4" />
                  </motion.div>
                  <span className="text-sm font-medium">Swipe to explore</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        {events.length > 1 && (
          <div className="flex justify-center gap-1.5 pt-2">
            {events.map((_, i) => (
              <button
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? "w-6 h-2 bg-primary"
                    : "w-2 h-2 bg-primary/25"
                }`}
                onClick={() => {
                  const cardWidth = 320 + 16;
                  scrollRef.current?.scrollTo({ left: i * cardWidth, behavior: "smooth" });
                }}
                aria-label={`Go to event ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
