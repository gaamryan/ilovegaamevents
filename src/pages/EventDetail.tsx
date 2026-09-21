import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ExternalLink,
  Share2,
  User,
  Globe,
  Edit,
  Repeat,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSingleEvent } from "@/hooks/useSingleEvent";
import { useIsAdmin } from "@/hooks/useAuth";
import { shareEvent } from "@/lib/share";
import { SimilarEvents } from "@/components/events/SimilarEvents";
import { LazyImage } from "@/components/ui/LazyImage";

const ensureUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length < 4) return null;
  // Filter out obviously invalid URLs (sentences, etc.)
  if (trimmed.includes(' ') && !trimmed.startsWith('http')) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
};

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { data: event, isLoading, error } = useSingleEvent(id);

  const handleShare = () => {
    if (!event) return;
    shareEvent({
      title: event.title,
      description: event.description,
      url: window.location.href,
      eventId: event.id,
    });
  };

  const getFullAddress = () => {
    if (!event?.venue) return null;
    const parts = [
      event.venue.address_line_1,
      event.venue.address_line_2,
      event.venue.city,
      event.venue.state,
      event.venue.postal_code,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const getMapUrl = () => {
    if (!event?.venue) return null;
    const { latitude, longitude, name } = event.venue;
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    const address = getFullAddress();
    if (address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ", " + address)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  };

  const getStaticMapUrl = () => {
    if (!event?.venue) return null;
    const { latitude, longitude } = event.venue;
    if (latitude && longitude) {
      // Using OpenStreetMap static tiles
      return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=600x300&markers=${latitude},${longitude},red`;
    }
    return null;
  };

  const getPriceDisplay = () => {
    if (event?.is_free) return "Free";
    if (event?.pricing_at_site) return "Pricing available at event site";
    if (event?.price_min && event?.price_max && event.price_min !== event.price_max) {
      return `$${event.price_min} - $${event.price_max}`;
    }
    if (event?.price_min) return `From $${event.price_min}`;
    return null;
  };

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold mb-2">Event not found</h2>
          <p className="text-muted-foreground text-center mb-4">
            This event may have been removed or doesn't exist.
          </p>
          <Button onClick={() => navigate("/")}>Back to Events</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideBottomNav>
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/admin?edit=${id}`)}
                className="rounded-full text-primary"
                title="Edit Event"
              >
                <Edit className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="rounded-full"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-[60px] pb-24">
        {isLoading ? (
          <EventDetailSkeleton />
        ) : event ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Helmet>
              <title>{event.title} | GAAM Events</title>
              <meta name="description" content={event.description?.replace(/<[^>]*>?/gm, "").substring(0, 160) || event.title} />
              <meta property="og:title" content={event.title} />
              <meta property="og:description" content={event.description?.replace(/<[^>]*>?/gm, "").substring(0, 160) || event.title} />
              <meta property="og:type" content="event" />
              <meta property="og:url" content={window.location.href} />
              {event.image_url && <meta property="og:image" content={event.image_url} />}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content={event.title} />
              <meta name="twitter:description" content={event.description?.replace(/<[^>]*>?/gm, "").substring(0, 160) || event.title} />
              {event.image_url && <meta name="twitter:image" content={event.image_url} />}
            </Helmet>
            {/* Hero Image */}
            <div className="relative aspect-[16/10]">
              <LazyImage
                src={event.image_url}
                alt={event.title}
                className="w-full h-full"
                fallback={<div className="w-full h-full bg-gradient-primary opacity-30" />}
              />
              {/* Price Badge */}
              {getPriceDisplay() && (
                <div className="absolute bottom-4 left-4 px-4 py-2 rounded-full bg-card/90 backdrop-blur-sm text-lg font-bold">
                  {getPriceDisplay()}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Categories */}
              {event.event_categories && event.event_categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {event.event_categories.map((ec) => (
                    <Badge
                      key={ec.category.id}
                      className="text-sm"
                      style={{
                        backgroundColor: ec.category.color
                          ? `${ec.category.color}20`
                          : undefined,
                        color: ec.category.color || undefined,
                      }}
                    >
                      {ec.category.icon && <span className="mr-1">{ec.category.icon}</span>}
                      {ec.category.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>

              {/* Date & Time */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-foreground">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {format(new Date(event.start_time), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_time), "h:mm a")}
                      {event.end_time &&
                        ` - ${format(new Date(event.end_time), "h:mm a")}`}
                    </p>
                    {event.is_recurring && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Repeat className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm text-primary font-medium capitalize">
                          {event.recurrence_frequency === "biweekly"
                            ? "Every 2 weeks"
                            : `Every ${event.recurrence_frequency || "week"}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Venue */}
                {event.venue && (
                  <a
                    href={getMapUrl() || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-foreground hover:text-primary transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.venue.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getFullAddress() || event.venue.city}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                )}

                {/* Host */}
                {event.host && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {event.host.logo_url ? (
                        <img
                          src={event.host.logo_url}
                          alt={event.host.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Hosted by {event.host.name}</p>
                      {event.host.website_url && (
                        <a
                          href={event.host.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" />
                          Visit website
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Map */}
              {getStaticMapUrl() && (
                <a
                  href={getMapUrl() || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden border border-border"
                >
                  <img
                    src={getStaticMapUrl()!}
                    alt="Event location map"
                    className="w-full h-40 object-cover"
                  />
                </a>
              )}

              {/* Description */}
              {event.description && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">About this event</h2>
                  <div
                    className="text-muted-foreground prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                </div>
              )}

              {/* Source */}
              {ensureUrl(event.source_url) && (
                <a
                  href={ensureUrl(event.source_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View original listing
                </a>
              )}
            </div>
          </motion.div>
        ) : null}
      </div>

      {/* Similar Events */}
      {event && (
        <div className="pb-20">
          <SimilarEvents
            eventId={event.id}
            categoryIds={event.event_categories?.map(ec => ec.category.id) || []}
            venueId={event.venue?.id}
          />
        </div>
      )}

      {/* Fixed Bottom CTA */}
      {event && (() => {
        const ticketLink = ensureUrl(event.ticket_url);
        const sourceLink = ensureUrl(event.source_url);
        const ctaUrl = ticketLink || sourceLink;
        const ctaLabel = ticketLink ? "Get Tickets" : "Visit Original Listing";
        const CtaIcon = ticketLink ? Ticket : ExternalLink;

        return (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border z-40">
            <div className="flex gap-3">
              {ctaUrl ? (
                <Button className="flex-1 h-12 text-base gap-2" asChild>
                  <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
                    <CtaIcon className="h-5 w-5" />
                    {ctaLabel}
                  </a>
                </Button>
              ) : (
                <Button className="flex-1 h-12 text-base gap-2" disabled>
                  <Ticket className="h-5 w-5" />
                  No link available
                </Button>
              )}
            </div>
          </div>
        );
      })()}
    </AppLayout>
  );
};

function EventDetailSkeleton() {
  return (
    <div>
      {/* Hero image */}
      <div className="skeleton aspect-[16/10] w-full" />
      <div className="p-4 space-y-6">
        {/* Category badges */}
        <div className="flex gap-2">
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
        {/* Title */}
        <div className="space-y-2">
          <div className="skeleton h-7 w-4/5" />
          <div className="skeleton h-7 w-2/3" />
        </div>
        {/* Date row */}
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-28" />
          </div>
        </div>
        {/* Venue row */}
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-56" />
          </div>
        </div>
        {/* Host row */}
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-36" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
        {/* Map */}
        <div className="skeleton h-40 w-full rounded-xl" />
        {/* Description */}
        <div className="space-y-2">
          <div className="skeleton h-5 w-36" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default EventDetail;
