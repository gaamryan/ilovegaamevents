import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Calendar as CalendarIcon, AlertCircle, FileText, Globe, X, Layers, User, MapPin, Clock, Copy, Tag, Gamepad2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/useCategories";
import { useSettings } from "@/hooks/useSettings";

interface ScrapedEvent {
  id?: string;
  title: string;
  description: string;
  start_time: string;
  end_time?: string | null;
  image_url: string | null;
  source_url: string;
  status: "draft" | "pending" | "approved" | "rejected";
  source: "manual" | "eventbrite" | "meetup" | "ticketspice" | "facebook" | "instagram" | "startgg";
  venue?: { name: string } | null;
  organizer?: string;
  location?: string;
  address?: string;
  google_maps_link?: string;
  is_series?: boolean;
  dates?: string[];
  import_mode?: "merge" | "split";
  ticket_url?: string;
  price_min?: number | null;
  price_max?: number | null;
  _warning?: string;
  selectedCategoryIds?: string[];
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  featured?: boolean;
  pricing_at_site?: boolean;
  is_recurring?: boolean;
  recurrence_frequency?: string;
  recurrence_until?: string;
}

interface ImportEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportEventDialog({ open, onOpenChange }: ImportEventDialogProps) {
  const [activeTab, setActiveTab] = useState("url");
  const [urlInput, setUrlInput] = useState("");
  const [startggInput, setStartggInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [manualSource, setManualSource] = useState<ScrapedEvent["source"]>("manual");

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [previewEvents, setPreviewEvents] = useState<ScrapedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();

  const DEFAULT_IMPORT_TEMPLATE = `please organize and state the following:
Event Name
Event Start Date
Event Start Time
Event End Date
Event End Time
Location (street address, city, state, zipcode)
Address
Google Maps Link to Address
Host
Ticket Link
Description
Cost
Cover Image : please copy and paste the full url path to the cover image`;

  const handlePreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setPreviewEvents([]);
    setIsLoading(true);

    try {
      if (activeTab === "url" || activeTab === "startgg") {
        const rawInput = activeTab === "startgg" ? startggInput : urlInput;
        if (!rawInput.trim()) return;

        const urls = rawInput
          .split("\n")
          .map((u) => u.trim())
          .filter((u) => u.length > 0);

        if (urls.length === 0) return;

        const results: ScrapedEvent[] = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          setLoadingMessage(`Scanning ${i + 1}/${urls.length}: ${new URL(url).hostname}...`);

          try {
            const { data, error } = await supabase.functions.invoke('import-event', {
              body: { url },
            });

            if (error) throw error;

            if (data) {
              // Show server-side validation warnings if any
              if (data._warnings && data._warnings.length > 0) {
                toast.warning(`${new URL(url).hostname}: ${data._warnings.join(", ")}`);
              }
              results.push({
                ...data,
                _warning: data._warnings?.join("; ") || undefined,
                id: Math.random().toString(36).substring(2, 9),
                import_mode: data.is_series ? "merge" : undefined,
                status: "approved"
              });
              successCount++;
            }
          } catch (err) {
            console.error(`Failed to fetch ${url}`, err);
            failCount++;
          }
        }

        setPreviewEvents(results);

        if (failCount > 0) {
          toast.warning(`Finished scanning. ${successCount} found, ${failCount} failed.`);
        } else {
          toast.success(`Found ${successCount} events!`);
        }

      } else {
        // Text Parsing Logic
        if (!textInput) return;
        const parsed = parseEventText(textInput, manualSource);
        parsed.id = Math.random().toString(36).substring(2, 9);
        parsed.status = "approved";
        setPreviewEvents([parsed]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process event data.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleRemoveEvent = (id: string) => {
    setPreviewEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleImportModeToggle = (id: string, mode: "merge" | "split") => {
    setPreviewEvents((prev) => prev.map(e => e.id === id ? { ...e, import_mode: mode } : e));
  };

  const handleToggleCategory = (eventId: string, categoryId: string) => {
    setPreviewEvents((prev) => prev.map(e => {
      if (e.id !== eventId) return e;
      const current = e.selectedCategoryIds || [];
      const updated = current.includes(categoryId)
        ? current.filter(c => c !== categoryId)
        : [...current, categoryId];
      return { ...e, selectedCategoryIds: updated };
    }));
  };

  const handleCopyEvent = (event: ScrapedEvent) => {
    const details = getFormattedEventString(event);
    navigator.clipboard.writeText(details);
    toast.success("Event details copied to clipboard!");
  };

  const handleQuickCopy = () => {
    if (!textInput) {
      const template = (typeof settings?.import_template === 'string' && settings.import_template)
        ? settings.import_template
        : DEFAULT_IMPORT_TEMPLATE;
      navigator.clipboard.writeText(template);
      toast.info("AI Prompt copied to clipboard!");
      return;
    }

    try {
      const parsed = parseEventText(textInput, manualSource);
      const details = getFormattedEventString(parsed);
      navigator.clipboard.writeText(details);
      toast.success("Parsed details copied to clipboard!");
    } catch (err) {
      toast.error("Failed to parse and copy.");
    }
  };

  const getFormattedEventString = (event: ScrapedEvent) => {
    const formatDate = (dateStr?: string | null) => {
      if (!dateStr || isNaN(Date.parse(dateStr))) return "TBD";
      return format(new Date(dateStr), "MM/dd/yyyy");
    };
    const formatTime = (dateStr?: string | null) => {
      if (!dateStr || isNaN(Date.parse(dateStr))) return "TBD";
      return format(new Date(dateStr), "h:mm a");
    };

    let cost = "TBD";
    if (event.price_min !== undefined && event.price_max !== undefined) {
      if (event.price_min === 0 && event.price_max === 0) cost = "Free";
      else if (event.price_min === event.price_max) cost = `$${event.price_min}`;
      else cost = `$${event.price_min} - $${event.price_max}`;
    }

    return `Event Name: ${event.title}
Event Start Date: ${formatDate(event.start_time)}
Event Start Time: ${formatTime(event.start_time)}
Event End Date: ${event.end_time ? formatDate(event.end_time) : formatDate(event.start_time)}
Event End Time: ${event.end_time ? formatTime(event.end_time) : "TBD"}
Location: ${event.venue?.name || event.location || "TBD"}, ${event.address || ""}
Address: ${event.address || "TBD"}
Google Maps Link to Address: ${event.google_maps_link || "TBD"}
Host: ${event.organizer || "TBD"}
Ticket Link: ${event.source_url || ""}
Description: ${event.description || ""}
Cost: ${cost}
full url to cover image: ${event.image_url || "TBD"}`;
  };

  const handleImport = async () => {
    if (previewEvents.length === 0) return;

    // Client-side validation before saving
    const invalid = previewEvents.filter(e =>
      !e.title?.trim() || e.title === "New Event (Import Failed)" ||
      !e.start_time || isNaN(Date.parse(e.start_time))
    );
    if (invalid.length > 0) {
      toast.error(`${invalid.length} event(s) have missing title or invalid date. Please fix before importing.`);
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Importing events...");

    let totalImported = 0;

    try {
      const eventsToInsert: any[] = [];
      const eventCategoryMap: { eventIndex: number; categoryIds: string[] }[] = [];
      const concurrencyLimit = 3;
      let processedCount = 0;
      const totalEvents = previewEvents.length;

      // Use the full image URL directly (no optimization/re-upload)
      const processImage = async (event: ScrapedEvent) => {
        processedCount++;
        setLoadingMessage(`Importing ${processedCount}/${totalEvents}...`);
        return event;
      };

      // Helper for concurrency
      const chunkedEvents = [];
      for (let i = 0; i < previewEvents.length; i += concurrencyLimit) {
        const chunk = previewEvents.slice(i, i + concurrencyLimit);
        const processedChunk = await Promise.all(chunk.map(processImage));
        chunkedEvents.push(...processedChunk);
      }

      const processedEvents = chunkedEvents; // Flat list of events with processed images

      for (const event of processedEvents) {
        // Clean up UI-only properties
        // 'location' must be removed. 'venue' must be removed (is object).
        const {
          id, _warning, is_series, dates, import_mode,
          organizer, google_maps_link, address, location, venue,
          city: eventCity, state: eventState, postal_code: eventZip,
          selectedCategoryIds, featured, pricing_at_site,
          is_recurring, recurrence_frequency, recurrence_until,
          ...baseEvent
        } = event;

        // 2. Upsert Venue first if exists (Sequential to avoid race conditions on same venue)
        let venue_id = null;
        if (venue || location) { // derived from destructured vars
          const venueName = venue?.name || location;
          if (venueName) {
            // Try to find existing venue by name
            const { data: existingVenue } = await supabase.from('venues').select('id').eq('name', venueName).maybeSingle();

            if (existingVenue) {
              venue_id = existingVenue.id;
            } else {
              // Create new venue
              const addrParts = parseAddress(address || "");
              const { data: newVenue, error: venueError } = await supabase.from('venues').insert({
                name: venueName,
                address_line_1: addrParts.addressLine1 || address || null,
                city: addrParts.city || eventCity || null,
                state: addrParts.state || eventState || null,
                postal_code: addrParts.postalCode || eventZip || null,
                map_url: google_maps_link || null
              }).select().single();

              if (!venueError && newVenue) {
                venue_id = newVenue.id;
              } else {
                console.error("Failed to create venue", venueError);
              }
            }
          }
        }

        // 2. Upsert Host first if exists
        let host_id = null;
        if (organizer) {
          const { data: existingHost } = await supabase.from('hosts').select('id').eq('name', organizer).single();
          if (existingHost) {
            host_id = existingHost.id;
          } else {
            const { data: newHost, error: hostError } = await supabase.from('hosts').insert({
              name: organizer,
              source: manualSource // or default to manual
            }).select().single();

            if (!hostError && newHost) {
              host_id = newHost.id;
            } else {
              console.error("Failed to create host", hostError);
            }
          }
        }

        // Let's enhance the description with Host info if needed, or if we have columns
        // For now, let's append rich info to description as a fallback to ensure it's visible
        let richDescription = baseEvent.description || "";

        if (organizer) richDescription = `Hosted by: ${organizer}\n\n${richDescription}`;
        // Map link is now in venue, but keep in description if specific event link differs? No, clean is better.

        // Prepare base object
        const commonData: any = {
          ...baseEvent,
          description: richDescription,
          status: "approved",
          featured: !!featured,
          pricing_at_site: !!pricing_at_site,
          venue_id: venue_id,
          host_id: host_id,
          is_recurring: !!is_recurring,
          recurrence_frequency: is_recurring ? (recurrence_frequency || null) : null,
          recurrence_until: is_recurring && recurrence_until ? new Date(recurrence_until).toISOString() : null,
        };

        const catIds = selectedCategoryIds || [];

        if (is_series && import_mode === "split" && dates && dates.length > 0) {
          for (const date of dates) {
            const idx = eventsToInsert.length;
            eventsToInsert.push({ ...commonData, start_time: date, end_time: null });
            if (catIds.length > 0) eventCategoryMap.push({ eventIndex: idx, categoryIds: catIds });
          }
        } else {
          if (is_series && import_mode === "merge") {
            commonData.description += "\n\n(This is a recurring event series.)";
          }
          const idx = eventsToInsert.length;
          eventsToInsert.push(commonData);
          if (catIds.length > 0) eventCategoryMap.push({ eventIndex: idx, categoryIds: catIds });
        }
      }

      // Auto-optimize images: re-upload external URLs to our storage
      const looksLikeImageUrl = (u: string) => {
        try {
          const parsed = new URL(u);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
          if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(parsed.pathname)) return true;
          // Known event-page hosts that are HTML, not images
          const htmlHosts = ["facebook.com", "www.facebook.com", "eventbrite.com", "www.eventbrite.com", "meetup.com", "www.meetup.com"];
          if (htmlHosts.includes(parsed.hostname) && !/\.(png|jpe?g|webp|gif|avif)/i.test(parsed.pathname)) return false;
          return true; // unknown — let the edge function try
        } catch { return false; }
      };
      toast.info("Optimizing images...");
      for (const evt of eventsToInsert) {
        if (evt.image_url && !evt.image_url.includes("event-images")) {
          if (!looksLikeImageUrl(evt.image_url)) {
            console.warn("Skipping non-image URL:", evt.image_url);
            evt.image_url = null;
            continue;
          }
          try {
            const { data: optimized, error: optErr } = await supabase.functions.invoke("optimize-image", {
              body: JSON.stringify({ imageUrl: evt.image_url }),
              headers: { "Content-Type": "application/json" },
            });
            if (!optErr && optimized?.url) {
              evt.image_url = optimized.url;
              evt.image_optimized = true;
            } else {
              console.warn("Image optimization failed for", evt.image_url, optErr);
            }
          } catch (e) {
            console.warn("Image optimization error, keeping original URL:", e);
          }
        }
      }


      const { data: insertedEvents, error } = await supabase.from("events").insert(eventsToInsert).select("id");

      if (error) throw error;

      // Insert event_categories links
      if (insertedEvents && eventCategoryMap.length > 0) {
        const categoryLinks: { event_id: string; category_id: string }[] = [];
        for (const mapping of eventCategoryMap) {
          const eventId = insertedEvents[mapping.eventIndex]?.id;
          if (eventId) {
            for (const catId of mapping.categoryIds) {
              categoryLinks.push({ event_id: eventId, category_id: catId });
            }
          }
        }
        if (categoryLinks.length > 0) {
          const { error: catError } = await supabase.from("event_categories").insert(categoryLinks);
          if (catError) console.error("Failed to link categories:", catError);
        }
      }

      toast.success(`${eventsToInsert.length} events imported successfully as APPROVED`);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);

      // Reset state
      setUrlInput("");
      setTextInput("");
      setPreviewEvents([]);
      setManualSource("manual");
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save events: ${err.message || err.details || "Unknown error"}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Events</DialogTitle>
          <DialogDescription>
            Import event details from URLs (one per line) or by pasting text.
          </DialogDescription>
        </DialogHeader>

        {previewEvents.length === 0 ? (
          <Tabs defaultValue="url" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="url">
                <Globe className="h-4 w-4 mr-2" />
                From URLs
              </TabsTrigger>
              <TabsTrigger value="startgg">
                <Gamepad2 className="h-4 w-4 mr-2" />
                From start.gg
              </TabsTrigger>
              <TabsTrigger value="text">
                <FileText className="h-4 w-4 mr-2" />
                From Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url">
              <form onSubmit={handlePreview} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Event URLs (One per line)</Label>
                  <Textarea
                    id="url"
                    placeholder="https://eventbrite.com/e/...\nhttps://instagram.com/p/...\nhttps://meetup.com/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isLoading}
                    className="min-h-[150px] font-mono text-xs leading-relaxed"
                  />
                </div>
                {error && <ErrorMessage message={error} />}
                <Button type="submit" className="w-full" disabled={isLoading || !urlInput.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {loadingMessage || "Processing..."}
                    </>
                  ) : "Scan URLs"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="startgg">
              <form onSubmit={handlePreview} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="startgg-url">start.gg Tournament URLs (One per line)</Label>
                  <Textarea
                    id="startgg-url"
                    placeholder="https://www.start.gg/tournament/my-tournament/details"
                    value={startggInput}
                    onChange={(e) => setStartggInput(e.target.value)}
                    disabled={isLoading}
                    className="min-h-[150px] font-mono text-xs leading-relaxed"
                  />
                </div>
                {error && <ErrorMessage message={error} />}
                <Button type="submit" className="w-full" disabled={isLoading || !startggInput.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {loadingMessage || "Processing..."}
                    </>
                  ) : "Scan Tournaments"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="text">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Source Platform</Label>
                  <Select value={manualSource} onValueChange={(val: any) => setManualSource(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual / Other</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="meetup">Meetup</SelectItem>
                      <SelectItem value="ticketspice">TicketSpice</SelectItem>
                      <SelectItem value="eventbrite">Eventbrite</SelectItem>
                      <SelectItem value="startgg">start.gg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-input">Paste Event Details</Label>
                  <Textarea
                    id="text-input"
                    placeholder="Event Name: ...&#10;Start Date: ...&#10;Description: ..."
                    className="min-h-[200px] font-mono text-sm"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported fields: Event Name, Start Date, Start Time, End Date, End Time, Description, Ticket URL, Page URL, Venue, Address, Host.
                  </p>
                </div>
                {error && <ErrorMessage message={error} />}
                <div className="flex gap-2">
                  <Button onClick={() => handlePreview()} className="flex-1" disabled={isLoading || !textInput}>
                    {isLoading ? "Parsing..." : "Preview"}
                  </Button>
                  <Button onClick={handleQuickCopy} variant="outline" className="flex-none" disabled={isLoading} title={textInput ? "Copy Formatted Text" : "Copy Template"}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground pb-2 border-b">
              <span>Found {previewEvents.length} event{previewEvents.length !== 1 && 's'}</span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewEvents([])} className="h-auto p-0 hover:bg-transparent hover:text-foreground">
                <X className="w-3 h-3 mr-1" /> Clear All
              </Button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {previewEvents.map((event, index) => (
                <div key={event.id || index} className="relative group border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex gap-3">
                    {/* Thumbnail + Image URL */}
                    <div className="flex flex-col gap-1.5 w-24 shrink-0">
                      <div className="w-24 h-24 bg-muted rounded overflow-hidden">
                        <EventPreviewImage src={event.image_url} alt={event.title} />
                      </div>
                      <Input
                        placeholder="Image URL"
                        value={event.image_url || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreviewEvents((prev) => prev.map(ev =>
                            ev.id === event.id ? { ...ev, image_url: val || null } : ev
                          ));
                        }}
                        className="h-6 text-[10px] px-1.5 w-full"
                        title="Paste direct image URL"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm truncate max-w-[200px]" title={event.title}>{event.title}</h4>
                          {event.is_series && (
                            <span className="flex items-center gap-1 text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                              <Layers className="w-3 h-3" />
                              Series
                            </span>
                          )}
                          {event._warning && (
                            <span
                              className="flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium cursor-help"
                              title={event._warning}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Issues
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 absolute top-2 right-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => handleCopyEvent(event)}
                            title="Copy Details"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => event.id && handleRemoveEvent(event.id)}
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {/* Host */}
                        {event.organizer && (
                          <div className="flex items-center gap-1.5 text-foreground/80">
                            <User className="w-3 h-3" />
                            <span className="truncate">{event.organizer}</span>
                          </div>
                        )}

                        {/* Date/Time */}
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {event.start_time && !isNaN(Date.parse(event.start_time))
                              ? format(new Date(event.start_time), "MMM d, h:mm a")
                              : "No Date"}
                            {event.end_time && !isNaN(Date.parse(event.end_time)) && (
                              ` - ${format(new Date(event.end_time), "h:mm a")}`
                            )}
                          </span>
                        </div>

                        {/* Location */}
                        {(event.location || event.venue?.name) && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{event.location || event.venue?.name}</span>
                            {event.google_maps_link && (
                              <a
                                href={event.google_maps_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-500 hover:underline ml-1"
                                title="Open in Google Maps"
                                onClick={(e) => e.stopPropagation()}
                              >
                                (Map)
                              </a>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 bg-secondary px-1.5 py-0.5 rounded capitalize">
                            {event.source}
                          </span>
                          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded capitalize text-[10px]">
                            Approved
                          </span>
                        </div>

                        {/* Featured Toggle */}
                        <div className="flex items-center gap-2 mt-2">
                          <Switch
                            id={`featured-${event.id}`}
                            checked={!!event.featured}
                            onCheckedChange={(checked) => {
                              setPreviewEvents((prev) => prev.map(e =>
                                e.id === event.id ? { ...e, featured: checked } : e
                              ));
                            }}
                          />
                          <label htmlFor={`featured-${event.id}`} className="text-xs font-medium cursor-pointer flex items-center gap-1">
                            ⭐ Featured
                          </label>
                        </div>

                        {/* Pricing at Site Toggle */}
                        <div className="flex items-center gap-2 mt-2">
                          <Switch
                            id={`pricing-at-site-${event.id}`}
                            checked={!!event.pricing_at_site}
                            onCheckedChange={(checked) => {
                              setPreviewEvents((prev) => prev.map(e =>
                                e.id === event.id ? { ...e, pricing_at_site: checked } : e
                              ));
                            }}
                          />
                          <label htmlFor={`pricing-at-site-${event.id}`} className="text-xs font-medium cursor-pointer">
                            Pricing at event site
                          </label>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Switch
                            id={`recurring-${event.id}`}
                            checked={!!event.is_recurring}
                            onCheckedChange={(checked) => {
                              setPreviewEvents((prev) => prev.map(e =>
                                e.id === event.id ? { ...e, is_recurring: checked } : e
                              ));
                            }}
                          />
                          <label htmlFor={`recurring-${event.id}`} className="text-xs font-medium cursor-pointer flex items-center gap-1">
                            🔁 Recurring
                          </label>
                        </div>

                        {event.is_recurring && (
                          <div className="flex gap-2 mt-1.5">
                            <select
                              className="flex h-7 rounded-md border border-input bg-background px-2 text-xs flex-1"
                              value={event.recurrence_frequency || ""}
                              onChange={(e) => {
                                setPreviewEvents((prev) => prev.map(ev =>
                                  ev.id === event.id ? { ...ev, recurrence_frequency: e.target.value } : ev
                                ));
                              }}
                            >
                              <option value="">Frequency</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="biweekly">Biweekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-7 text-xs flex-1 justify-start text-left font-normal",
                                    !event.recurrence_until && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {event.recurrence_until ? format(new Date(event.recurrence_until), "PPP") : "Until"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={event.recurrence_until ? new Date(event.recurrence_until) : undefined}
                                  onSelect={(date) => {
                                    setPreviewEvents((prev) => prev.map(ev =>
                                      ev.id === event.id ? { ...ev, recurrence_until: date ? format(date, "yyyy-MM-dd") : "" } : ev
                                    ));
                                  }}
                                  initialFocus
                                  className="p-3 pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>

                      {/* Category Selection */}
                      {categories && categories.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Categories</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {categories.map((cat) => {
                              const isSelected = event.selectedCategoryIds?.includes(cat.id);
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => event.id && handleToggleCategory(event.id, cat.id)}
                                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                                  }`}
                                >
                                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                                  {cat.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {event.is_series && (
                        <div className="mt-2 p-2 bg-secondary/50 rounded-md flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {event.import_mode === "merge"
                              ? "Import as single event"
                              : `Import as ${event.dates?.length || 0} separate events`
                            }
                          </span>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`mode-${event.id}`} className="text-xs cursor-pointer">Split</Label>
                            <Switch
                              id={`mode-${event.id}`}
                              checked={event.import_mode === "split"}
                              onCheckedChange={(checked) => handleImportModeToggle(event.id!, checked ? "split" : "merge")}
                            />
                          </div>
                        </div>
                      )}

                      {event._warning && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {event._warning}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
              <Button variant="outline" onClick={() => setPreviewEvents([])} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {loadingMessage}
                  </>
                ) : (
                  `Import Events`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventPreviewImage({ src, alt }: { src: string | null, alt: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted p-1 text-center">
        {src ? (
          <>
            <AlertCircle className="w-5 h-5 opacity-20 mb-1" />
            <span className="text-[9px] leading-tight">Preview Restricted<br />(Fixed on Import)</span>
          </>
        ) : (
          <AlertCircle className="w-6 h-6 opacity-20" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// Helper: Parse Key-Value text
function parseEventText(text: string, source: ScrapedEvent["source"]): ScrapedEvent {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const data: any = {};

  // Comprehensive Regexes matching user format
  const strategies = [
    { key: 'title', regex: /^(?:Event Name|Title):\s*(.*)/i },
    { key: 'start_date', regex: /^(?:Event Start Date|Start Date|Date):\s*(.*)/i },
    { key: 'start_time', regex: /^(?:Event Start Time|Start Time|Time):\s*(.*)/i },
    { key: 'end_date', regex: /^(?:Event End Date|End Date):\s*(.*)/i },
    { key: 'end_time', regex: /^(?:Event End Time|End Time):\s*(.*)/i },
    { key: 'venue', regex: /^(?:Location.*|Venue):\s*(.*)/i }, // Matches "Location (street...):"
    { key: 'address', regex: /^(?:Address):\s*(.*)/i },
    { key: 'map_link', regex: /^(?:Google Maps Link.*):\s*(.*)/i },
    { key: 'organizer', regex: /^(?:Host|Organizer):\s*(.*)/i },
    { key: 'ticket_url', regex: /^(?:Ticket Link|Tickets|Ticket URL):\s*(.*)/i },
    { key: 'description', regex: /^(?:Description|Details):\s*(.*)/i },
    { key: 'cost', regex: /^(?:Cost|Price):\s*(.*)/i },
    { key: 'image_url', regex: /^(?:Full URL.*image|Cover Image|Image URL):\s*(.*)/i },
  ];

  let currentKey = "description_append";
  let descriptionBuffer = "";

  for (const line of lines) {
    let matched = false;

    for (const { key, regex } of strategies) {
      const match = line.match(regex);
      if (match) {
        if (key === 'description') {
          currentKey = 'description';
          descriptionBuffer += match[1] + "\n";
        } else {
          data[key] = match[1].trim();
          currentKey = key;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Append continuation lines to description if we are in description mode
      // OR if it's just general text that didn't match anything and we haven't started matching yet
      if (currentKey === 'description' || currentKey === 'description_append') {
        descriptionBuffer += line + "\n";
      }
    }
  }

  // Combine description (prepend title if it ended up in description buffer?)
  // Actually, mostly just use buffer.
  data.description = descriptionBuffer.trim();

  // Date Parsing Helper
  const parseDateTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return null;
    let combined = dateStr;
    if (timeStr) combined += ` ${timeStr}`;

    const parsed = Date.parse(combined);
    if (!isNaN(parsed)) return new Date(parsed).toISOString();
    return null;
  };

  const startIso = parseDateTime(data.start_date || data.start_time, data.start_time) || new Date().toISOString();
  // Fallback: if only start_time matched (because regex matched "Time" for date?), handle gracefully?
  // User input "Event Start Date" is specific. 

  const endIso = parseDateTime(data.end_date || data.start_date, data.end_time); // Fallback to start date if end time provided but no end date

  const finalUrl = data.ticket_url || ""; // source_url is effectively ticket link in this context

  // Cost parsing (naive)
  let minPrice = 0;
  let maxPrice = 0;
  let pricingAtSite = false;
  if (data.cost) {
    const costLower = data.cost.toLowerCase();
    if (costLower.includes("available at") || costLower.includes("see event") || costLower.includes("see site") || costLower.includes("check site") || costLower.includes("at the door") || costLower.includes("on site") || costLower.includes("event page") || costLower.includes("varies")) {
      pricingAtSite = true;
    } else {
      const nums = data.cost.match(/\$?(\d+)/g);
      if (nums) {
        if (nums.length === 1) {
          minPrice = maxPrice = parseInt(nums[0].replace('$', ''));
        } else {
          minPrice = parseInt(nums[0].replace('$', ''));
          maxPrice = parseInt(nums[nums.length - 1].replace('$', ''));
        }
      }
    }
  }

  return {
    title: data.title || "New Event",
    description: data.description || "",
    start_time: startIso,
    end_time: endIso,
    image_url: data.image_url || null,
    source_url: finalUrl,
    status: "approved",
    source: source,
    venue: data.venue ? { name: data.venue } : null,
    organizer: data.organizer,
    address: data.address,
    location: data.venue,
    google_maps_link: data.map_link,
    price_min: minPrice,
    price_max: maxPrice,
    pricing_at_site: pricingAtSite,
    ticket_url: data.ticket_url,
    city: data.city,
    state: data.state,
    postal_code: data.postal_code,
    _warning: undefined
  };
}

// Logic to try and break down an address string
function parseAddress(addressStr: string) {
  if (!addressStr) return {};

  // Heuristic: "1000 Water St, Jacksonville, FL 32204"
  // Regex for: Street, City, State Zip
  const parts = addressStr.split(',').map(p => p.trim());

  // Simple state/zip logic: "FL 32204"
  const stateZipRegex = /^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i;

  const result: any = {
    addressLine1: parts[0]
  };

  if (parts.length >= 3) {
    result.city = parts[1];
    const stateZipMatch = parts[2].match(stateZipRegex);
    if (stateZipMatch) {
      result.state = stateZipMatch[1];
      result.postalCode = stateZipMatch[2];
    } else {
      result.state = parts[2];
    }
  } else if (parts.length === 2) {
    // "Jacksonville, FL 32204" or "1000 Water St, Jacksonville"
    const stateZipMatch = parts[1].match(stateZipRegex);
    if (stateZipMatch) {
      result.state = stateZipMatch[1];
      result.postalCode = stateZipMatch[2];
    } else {
      result.city = parts[1];
    }
  }

  return result;
}
