import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, CalendarDays } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import {
  useCategories,
  useCategoryUpcomingCounts,
  filterCategoriesWithUpcoming,
} from "@/hooks/useCategories";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

const HOW_KEY = "categories-how-open";

const rowClass =
  "flex items-center gap-3 min-h-16 p-3 rounded-xl bg-card border border-border hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const Categories = () => {
  const { data: categories, isLoading } = useCategories();
  const { data: counts, isLoading: countsLoading } = useCategoryUpcomingCounts();
  const [howOpen, setHowOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HOW_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleHow = () => {
    setHowOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HOW_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const visible = counts ? filterCategoriesWithUpcoming(categories, counts) : [];
  const loading = isLoading || countsLoading;
  const totalUpcoming = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <Helmet>
        <title>Categories | {SITE_NAME}</title>
        <meta name="description" content="Browse upcoming Jacksonville events by interest." />
        <link rel="canonical" href={`${SITE_URL}/categories`} />
      </Helmet>
      <PageHeader title="Categories" subtitle="Browse by interest" />

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Pick what you're into. Only categories with upcoming events show up here.
          </p>
          <button
            type="button"
            onClick={toggleHow}
            aria-expanded={howOpen}
            aria-controls="categories-how"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            How this works
            <ChevronDown className={`h-4 w-4 transition-transform ${howOpen ? "rotate-180" : ""}`} />
          </button>
          {howOpen && (
            <ul id="categories-how" className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>Tap a category to see its upcoming events.</li>
              <li>Events can belong to more than one category.</li>
              <li>Want several at once? Use Filters on the Discover page.</li>
            </ul>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[68px] rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-4xl" aria-hidden>🗓️</p>
            <h2 className="font-semibold">Nothing on the calendar yet</h2>
            <p className="text-sm text-muted-foreground">
              New events land all the time. Check back soon or browse everything.
            </p>
            <Button asChild>
              <Link to="/">Back to Discover</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 motion-safe:animate-fade-in">
            <Link to="/" className={rowClass}>
              <span className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="h-5 w-5 text-primary" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-sm text-foreground">All events</span>
                <span className="block text-xs text-muted-foreground line-clamp-2">
                  Everything happening around town.
                </span>
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {totalUpcoming > 0 ? "Browse all" : ""}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </Link>
            {visible.map((category) => (
              <Link key={category.id} to={`/categories/${category.slug}`} className={rowClass}>
                <span
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ backgroundColor: category.color ? `${category.color}26` : undefined }}
                  aria-hidden
                >
                  {category.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm text-foreground">{category.name}</span>
                  {category.description && (
                    <span className="block text-xs text-muted-foreground line-clamp-2">
                      {category.description}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {counts?.[category.id] ?? 0} upcoming
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Categories;
