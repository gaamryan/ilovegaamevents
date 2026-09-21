import { motion } from "framer-motion";
import { Calendar, MapPin, Repeat, Share2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { shareEvent } from "@/lib/share";
import { LazyImage } from "@/components/ui/LazyImage";

interface EventCardProps {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  startTime: Date;
  venueName?: string;
  categories?: {
    name: string;
    icon: string | null;
    color: string | null;
  }[];
  isFree?: boolean;
  pricingAtSite?: boolean;
  priceMin?: number;
  priceMax?: number;
  isRecurring?: boolean;
  onClick?: (id: string) => void;
}

export function EventCard({
  id,
  title,
  description,
  imageUrl,
  startTime,
  venueName,
  categories,
  isFree,
  pricingAtSite,
  priceMin,
  priceMax,
  isRecurring,
  onClick,
}: EventCardProps) {
  const navigate = useNavigate();
  const formattedDate = format(new Date(startTime), "EEE, MMM d");
  const formattedTime = format(new Date(startTime), "h:mm a");

  const getPriceDisplay = () => {
    if (isFree) return "Free";
    if (pricingAtSite) return "See event site";
    if (priceMin && priceMax && priceMin !== priceMax) {
      return `$${priceMin} - $${priceMax}`;
    }
    if (priceMin) return `$${priceMin}`;
    return null;
  };

  const price = getPriceDisplay();

  const handleClick = () => {
    if (onClick) {
      onClick(id);
    } else {
      navigate(`/events/${id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="event-card cursor-pointer touch-feedback"
      onClick={handleClick}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <LazyImage
          src={imageUrl}
          alt={title}
          className="w-full h-full"
          fallback={<div className="w-full h-full bg-gradient-primary opacity-20" />}
        />

        {/* Action Buttons — hidden on mobile so they don't cover the image; shown from md up */}
        <div className="absolute top-3 right-3 hidden md:flex gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              shareEvent({
                title,
                url: `${window.location.origin}/events/${id}`,
              });
            }}
            className="w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            aria-label="Share event"
          >
            <Share2 className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {/* Price Badge — hidden on mobile so it doesn't cover the image; shown from md up */}
        {price && (
          <div className="absolute bottom-3 left-3 hidden md:block px-3 py-1 rounded-full bg-card/90 backdrop-blur-sm text-sm font-semibold">
            {price}
          </div>
        )}

        {/* Recurring Badge */}
        {isRecurring && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-card/90 backdrop-blur-sm text-xs font-medium flex items-center gap-1">
            <Repeat className="h-3 w-3 text-primary" />
            <span className="text-foreground">Recurring</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Category, Date & Time */}
        <div className="flex flex-col gap-1 text-sm">
          {categories && categories.length > 0 && (() => {
            const primaryCategory = categories[0];
            return (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium self-start"
                style={{
                  backgroundColor: primaryCategory.color ? `${primaryCategory.color}20` : undefined,
                  color: primaryCategory.color || undefined,
                }}
              >
                {primaryCategory.icon && <span>{primaryCategory.icon}</span>}
                {primaryCategory.name}
                {categories.length > 1 && <span className="opacity-70">+{categories.length - 1}</span>}
              </span>
            );
          })()}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formattedDate}</span>
          </div>
          <span className="text-muted-foreground text-xs ml-5">{formattedTime}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg line-clamp-2">{title}</h3>

        {/* Description */}
        {description && (
          <p className="text-muted-foreground text-sm line-clamp-2">
            {description.replace(/<[^>]*>/g, '')}
          </p>
        )}

        {/* Venue */}
        {venueName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{venueName}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
