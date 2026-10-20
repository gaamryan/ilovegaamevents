import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { EventGrid } from "@/components/events/EventGrid";
import { useCategories } from "@/hooks/useCategories";
import { useInfiniteApprovedEvents } from "@/hooks/useEvents";
import { useSettings } from "@/hooks/useSettings";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import NotFound from "@/pages/NotFound";

const CategoryPage = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: settings } = useSettings();
  const pageLimit = settings?.pagination_limit?.value || 20;

  // Hidden (no upcoming events) categories still resolve — only an unknown slug is a 404.
  const category = useMemo(
    () => categories?.find((c) => c.slug.toLowerCase() === slug.toLowerCase()),
    [categories, slug],
  );

  useEffect(() => {
    if (category && category.slug !== slug) navigate(`/categories/${category.slug}`, { replace: true });
  }, [category, slug, navigate]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteApprovedEvents({
    categoryIds: category ? [category.id] : undefined,
    limit: pageLimit,
    enabled: !!category,
  });
  const events = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  if (!categoriesLoading && categories && !category) return <NotFound />;

  const name = category?.name ?? "";
  const description = category
    ? `${category.description ? `${category.description} ` : ""}Upcoming ${category.name} events in Jacksonville and Northeast Florida.`.slice(0, 160)
    : "";
  const isEmpty = !!category && !isLoading && events.length === 0;

  return (
    <AppLayout>
      {category && (
        <Helmet>
          <title>{`${name} Events in Jacksonville | ${SITE_NAME}`}</title>
          <meta name="description" content={description} />
          <link rel="canonical" href={`${SITE_URL}/categories/${category.slug}`} />
          <meta property="og:title" content={`${name} Events in Jacksonville | ${SITE_NAME}`} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={`${SITE_URL}/categories/${category.slug}`} />
          {isEmpty && <meta name="robots" content="noindex,follow" />}
        </Helmet>
      )}
      <PageHeader
        title={category ? `${category.icon ?? ""} ${name}`.trim() : "Category"}
        subtitle={category?.description ?? undefined}
      />
      <div className="px-4 pt-3">
        <Link
          to="/categories"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All categories
        </Link>
      </div>
      <EventGrid
        events={events}
        isLoading={categoriesLoading || (!!category && isLoading)}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        pageLimit={pageLimit}
        empty={
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl" aria-hidden="true">🗓️</div>
            <h2 className="text-lg font-semibold">No upcoming {name} events yet.</h2>
            <p className="text-sm text-muted-foreground">New events land all the time. Check back soon.</p>
            <Button asChild>
              <Link to="/">Browse all events</Link>
            </Button>
          </div>
        }
      />
    </AppLayout>
  );
};

export default CategoryPage;
