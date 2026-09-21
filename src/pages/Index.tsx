import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, Map, List } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/header";
import { EventCard } from "@/components/events/EventCard";
import { EventListSkeleton } from "@/components/events/EventCardSkeleton";
import { FeaturedEvents } from "@/components/events/FeaturedEvents";
import { HappeningNow } from "@/components/events/HappeningNow";
import type { EventFilters } from "@/components/events/FilterDrawer";
import { SortSelect, type SortOption } from "@/components/events/SortSelect";

// Lazy-load heavy components — defers react-day-picker (106KB) until drawer opens
const EventMap = lazy(() => import("@/components/events/EventMap").then(m => ({ default: m.EventMap })));
const FilterDrawer = lazy(() => import("@/components/events/FilterDrawer").then(m => ({ default: m.FilterDrawer })));

import { useInfiniteApprovedEvents } from "@/hooks/useEvents";
import { useCategories } from "@/hooks/useCategories";
import { useSettings, DEFAULT_FEED_DISPLAY } from "@/hooks/useSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useSettings();
  const PAGE_LIMIT = settings?.pagination_limit?.value || 20;
  const feedDisplay = settings?.feed_display ?? DEFAULT_FEED_DISPLAY;
  const mobileColsClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" }[feedDisplay.mobileColumns];
  const desktopColsClass = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" }[feedDisplay.desktopColumns];

  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filters, setFilters] = useState<EventFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>("date_asc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Debounce the search box before it hits the network — search is applied
  // server-side (see below) so every keystroke would otherwise fire a query.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Read category from URL query param on mount
  useEffect(() => {
    const categoryFromUrl = searchParams.get("category");
    if (categoryFromUrl) {
      setFilters(prev => ({ ...prev, categoryIds: [categoryFromUrl] }));
      searchParams.delete("category");
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    data: infiniteData,
    isLoading: eventsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteApprovedEvents({
    categoryIds: filters.categoryIds,
    filters,
    sortBy,
    limit: PAGE_LIMIT,
    search: debouncedSearchQuery,
  });

  // Flatten all pages into a single array
  const events = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.data) ?? [],
    [infiniteData]
  );

  const { data: categories } = useCategories();

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "200px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.isFree) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.location) count++;
    if (filters.categoryIds && filters.categoryIds.length > 0) count++;
    return count;
  }, [filters]);

  // Get active filter tags for display
  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string }[] = [];
    if (searchQuery) {
      tags.push({ key: "search", label: `"${searchQuery}"` });
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const categoryNames = filters.categoryIds
        .map(id => categories?.find(c => c.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      tags.push({ key: "categories", label: categoryNames || "Categories" });
    }
    if (filters.dateFrom && filters.dateTo) {
      tags.push({ key: "date", label: `${filters.dateFrom.toLocaleDateString()} - ${filters.dateTo.toLocaleDateString()}` });
    } else if (filters.dateFrom) {
      tags.push({ key: "date", label: `From ${filters.dateFrom.toLocaleDateString()}` });
    } else if (filters.dateTo) {
      tags.push({ key: "date", label: `Until ${filters.dateTo.toLocaleDateString()}` });
    }
    if (filters.isFree) {
      tags.push({ key: "free", label: "Free events" });
    }
    if (filters.location) {
      tags.push({ key: "location", label: filters.location });
    }
    return tags;
  }, [filters, searchQuery, categories]);

  const removeFilter = (key: string) => {
    if (key === "search") {
      setSearchQuery("");
      return;
    }
    const newFilters = { ...filters };
    if (key === "date") {
      delete newFilters.dateFrom;
      delete newFilters.dateTo;
    } else if (key === "free") {
      delete newFilters.isFree;
    } else if (key === "location") {
      delete newFilters.location;
    } else if (key === "categories") {
      delete newFilters.categoryIds;
    }
    setFilters(newFilters);
  };

  return (
    <AppLayout>
      <PageHeader
        title="ILoveGAAM"
        subtitle="Events for Gamers, Artists, Music Lovers, Creators & Nerds in Jacksonville and the Southeast"
      />

      {/* Search & Filter Bar */}
      <div
        className="sticky z-30 border-b border-border transition-all duration-200"
        style={{
          top: isMobile && scrolled ? '43px' : '73px',
          background: 'var(--topbar-bg)',
          color: `hsl(var(--topbar-text))`,
          backdropFilter: 'blur(var(--topbar-blur))',
          WebkitBackdropFilter: 'blur(var(--topbar-blur))',
        }}
      >
        <div className={`px-4 transition-all duration-200 ${isMobile && scrolled ? 'py-1.5' : 'py-3'}`}>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (isMobile) setDrawerOpen(true); }}
                readOnly={isMobile}
                className={`pl-10 pr-12 transition-all duration-200 ${isMobile && scrolled ? 'h-9' : 'h-11'} ${isMobile ? 'cursor-pointer' : ''}`}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-10 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <Suspense fallback={<div className="w-9 h-9" />}>
                  <FilterDrawer
                    filters={filters}
                    onFiltersChange={setFilters}
                    activeFilterCount={activeFilterCount}
                    categories={categories || []}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                  />
                </Suspense>
              </div>
            </div>
            <SortSelect value={sortBy} onChange={setSortBy} />
            <Button
              variant={viewMode === "map" ? "default" : "outline"}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setViewMode(v => v === "list" ? "map" : "list")}
              aria-label={viewMode === "list" ? "Switch to map view" : "Switch to list view"}
            >
              {viewMode === "list" ? <Map className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Active Filter Tags */}
        <AnimatePresence>
          {activeFilterTags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 px-4 pb-3 flex-wrap"
            >
              {activeFilterTags.map((tag) => (
                <Badge
                  key={tag.key}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span className="truncate max-w-[150px]">{tag.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeFilter(tag.key)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Happening Now */}
      <HappeningNow />

      {/* Featured Events Section */}
      <FeaturedEvents />

      {/* Event List or Map */}
      {viewMode === "map" ? (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <EventMap events={events} />
        </Suspense>
      ) : (
        <div className={`p-4 grid gap-4 ${mobileColsClass} ${desktopColsClass} min-h-[600px]`}>
          {eventsLoading ? (
            <EventListSkeleton count={4} />
          ) : events && events.length > 0 ? (
            <>
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                >
                  <EventCard
                    id={event.id}
                    title={event.title}
                    description={event.description || undefined}
                    imageUrl={event.image_url || undefined}
                    startTime={new Date(event.start_time)}
                    venueName={event.venue?.name}
                    categories={event.event_categories?.map(ec => ec.category)}
                    isFree={event.is_free || false}
                    pricingAtSite={event.pricing_at_site || false}
                    priceMin={event.price_min || undefined}
                    priceMax={event.price_max || undefined}
                    isRecurring={event.is_recurring || false}
                  />
                </motion.div>
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={loadMoreRef} className="col-span-full flex justify-center py-6">
                {isFetchingNextPage && (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
                {!hasNextPage && events.length > PAGE_LIMIT && (
                  <p className="text-sm text-muted-foreground">You've seen all events</p>
                )}
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground text-sm">
                {activeFilterCount > 0 || searchQuery
                  ? "Try adjusting your filters to see more events."
                  : "Events will appear here once approved."}
              </p>
              {(activeFilterCount > 0 || searchQuery) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setFilters({});
                    setSearchQuery("");
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </motion.div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Index;
