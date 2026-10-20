import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/header";
import { EventGrid } from "@/components/events/EventGrid";
import { FeaturedEvents } from "@/components/events/FeaturedEvents";
import { HappeningNow } from "@/components/events/HappeningNow";
import type { EventFilters } from "@/components/events/FilterDrawer";
import { SortSelect, type SortOption } from "@/components/events/SortSelect";
import { SearchBar } from "@/components/events/SearchBar";
import { legacyCategoryRedirect, parseDiscoverParams, serializeDiscoverState, type DiscoverState } from "@/lib/discoverParams";

// Lazy-load heavy components — defers react-day-picker (106KB) until drawer opens
const FilterDrawer = lazy(() => import("@/components/events/FilterDrawer").then(m => ({ default: m.FilterDrawer })));

import { useInfiniteApprovedEvents } from "@/hooks/useEvents";
import { useCategories } from "@/hooks/useCategories";
import { useSettings } from "@/hooks/useSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveMeasurementId, trackSearch } from "@/lib/analytics";
import { Helmet } from "react-helmet-async";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

const Index = () => {
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: settings } = useSettings();
  const PAGE_LIMIT = settings?.pagination_limit?.value || 20;

  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: categories } = useCategories();
  const location = useLocation();
  const navigationType = useNavigationType();

  // Search, filters and sort live in the URL so a search can be shared,
  // reloaded and returned to with Back. Defaults stay out of the URL.
  const { query: searchQuery, filters, sortBy, categoriesPending } = useMemo(
    () => parseDiscoverParams(searchParams, categories),
    [searchParams, categories],
  );

  const latestParams = useRef(searchParams);
  latestParams.current = searchParams;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  // Old /?category=<id-or-slug> links now live at /categories/<slug>. Only the
  // URL the page was opened with is redirected, so picking a category in the
  // filters afterwards never bounces the visitor away.
  const navigate = useNavigate();
  const openedWith = useRef(searchParams);
  const redirectChecked = useRef(false);
  useEffect(() => {
    if (redirectChecked.current || !categories) return;
    redirectChecked.current = true;
    const target = legacyCategoryRedirect(openedWith.current, categories);
    if (target) navigate(target, { replace: true });
  }, [categories, navigate]);

  // Reads the newest params (not the render's) so two updates in one tick compose.
  const updateUrl = useCallback(
    (patch: Partial<DiscoverState>) => {
      const current = parseDiscoverParams(latestParams.current, categoriesRef.current);
      const next = serializeDiscoverState({ ...current, ...patch }, latestParams.current, categoriesRef.current);
      latestParams.current = next;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );
  const setSearchQuery = useCallback((query: string) => updateUrl({ query }), [updateUrl]);
  const setFilters = useCallback((next: EventFilters) => updateUrl({ filters: next }), [updateUrl]);
  const setSortBy = useCallback((next: SortOption) => updateUrl({ sortBy: next }), [updateUrl]);

  // Report actual searches (the committed, debounced term — not every
  // keystroke) to GA4 so search terms show up in Site Search reports.
  const measurementId = resolveMeasurementId(settings?.ga_measurement_id);
  useEffect(() => {
    if (!searchQuery) return;
    trackSearch(measurementId, searchQuery);
  }, [searchQuery, measurementId]);

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
    search: searchQuery,
    enabled: !categoriesPending,
  });

  // Flatten all pages into a single array
  const events = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.data) ?? [],
    [infiniteData]
  );

  // Coming back (Back button) to a list the user had scrolled: restore the
  // position once the cached pages render. Saving starts only after that.
  const restoreTarget = useRef<number | null>(null);
  const canSaveScroll = useRef(false);
  const scrollKey = `discover-scroll:${location.key}`;

  useEffect(() => {
    const saved = navigationType === "POP" ? sessionStorage.getItem(scrollKey) : null;
    restoreTarget.current = saved ? Number(saved) : null;
    canSaveScroll.current = restoreTarget.current === null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (restoreTarget.current === null || events.length === 0) return;
    const target = restoreTarget.current;
    restoreTarget.current = null;
    requestAnimationFrame(() => {
      window.scrollTo(0, target);
      canSaveScroll.current = true;
    });
  }, [events.length]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (!canSaveScroll.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

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
    if (filters.priceMin || filters.priceMax) {
      tags.push({ key: "price", label: `$${filters.priceMin || 0} - $${filters.priceMax || 200}+` });
    }
    return tags;
  }, [filters, categories]);

  const removeFilter = (key: string) => {
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
    } else if (key === "price") {
      delete newFilters.priceMin;
      delete newFilters.priceMax;
    }
    setFilters(newFilters);
  };

  return (
    <AppLayout>
      <Helmet>
        <title>{SITE_NAME} | Games, Art & Music Events in Jacksonville</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <link rel="canonical" href={`${SITE_URL}/`} />
      </Helmet>
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
            <SearchBar
              value={searchQuery}
              onCommit={setSearchQuery}
              onSelectVenue={(name) => updateUrl({ query: "", filters: { ...filters, location: name } })}
              compact={isMobile && scrolled}
            >
              <Suspense fallback={<div className="w-9 h-9" />}>
                <FilterDrawer
                  filters={filters}
                  onFiltersChange={setFilters}
                  activeFilterCount={activeFilterCount}
                  categories={categories || []}
                  open={drawerOpen}
                  onOpenChange={setDrawerOpen}
                />
              </Suspense>
            </SearchBar>
            <SortSelect value={sortBy} onChange={setSortBy} />
          </div>
        </div>

        {/* Active Filter Tags */}
        <AnimatePresence>
          {activeFilterTags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide px-4 pb-3"
            >
              {activeFilterTags.map((tag) => (
                <Badge
                  key={tag.key}
                  variant="secondary"
                  className="shrink-0 gap-1 pr-1"
                >
                  <span className="truncate max-w-[150px]">{tag.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove filter: ${tag.label}`}
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

      {/* Event List */}
      <EventGrid
        events={events}
        isLoading={eventsLoading || categoriesPending}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        pageLimit={PAGE_LIMIT}
        empty={
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
                  onClick={() => updateUrl({ query: "", filters: {} })}
                >
                  Clear all filters
                </Button>
              )}
            </motion.div>
        }
      />
    </AppLayout>
  );
};

export default Index;
