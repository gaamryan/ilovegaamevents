import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapEvent {
  id: string;
  title: string;
  start_time: string;
  image_url?: string | null;
  is_free?: boolean | null;
  venue?: {
    name: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

interface EventMapProps {
  events: MapEvent[];
}

function FitBounds({ events }: { events: MapEvent[] }) {
  const map = useMap();
  useEffect(() => {
    const points = events
      .filter((e) => e.venue?.latitude && e.venue?.longitude)
      .map((e) => [e.venue!.latitude!, e.venue!.longitude!] as [number, number]);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [events, map]);
  return null;
}

export function EventMap({ events }: EventMapProps) {
  const navigate = useNavigate();

  const mappableEvents = useMemo(
    () => events.filter((e) => e.venue?.latitude && e.venue?.longitude),
    [events]
  );

  // Default center: Jacksonville, FL
  const defaultCenter: [number, number] = [30.3322, -81.6557];

  if (mappableEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No events with location data to display on the map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[60vh] rounded-lg overflow-hidden border border-border mx-4 my-4">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        className="h-full w-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds events={mappableEvents} />
        {mappableEvents.map((event) => (
          <Marker
            key={event.id}
            position={[event.venue!.latitude!, event.venue!.longitude!]}
          >
            <Popup minWidth={200} maxWidth={280}>
              <div className="space-y-2 p-1">
                {event.image_url && (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-24 object-cover rounded-md"
                  />
                )}
                <h3 className="font-semibold text-sm leading-snug">{event.title}</h3>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(event.start_time), "EEE, MMM d • h:mm a")}</span>
                </div>
                {event.venue && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span>{event.venue.name}</span>
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  View Event
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
