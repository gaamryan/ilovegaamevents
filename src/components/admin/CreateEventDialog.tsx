import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { VenueCombobox } from "@/components/admin/VenueCombobox";
import { HostCombobox } from "@/components/admin/HostCombobox";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
  start_date: z.date({ required_error: "Start date is required" }),
  start_time: z.string().min(1, "Start time is required"),
  end_date: z.date().optional(),
  end_time: z.string().optional(),
  category_id: z.string().optional(),
  venue_name: z.string().max(200, "Venue name must be less than 200 characters").optional(),
  venue_city: z.string().max(100, "City must be less than 100 characters").optional(),
  venue_address: z.string().max(300, "Address must be less than 300 characters").optional(),
  host_name: z.string().max(200, "Host name must be less than 200 characters").optional(),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ticket_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  source_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  is_free: z.boolean().default(false),
  pricing_at_site: z.boolean().default(false),
  featured: z.boolean().default(false),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  is_recurring: z.boolean().default(false),
  recurrence_frequency: z.string().optional(),
  recurrence_until: z.date().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      start_time: "19:00",
      end_time: "",
      venue_name: "",
      venue_city: "",
      venue_address: "",
      host_name: "",
      image_url: "",
      ticket_url: "",
      source_url: "",
      is_free: false,
      featured: false,
      is_recurring: false,
      recurrence_frequency: "",
    },
  });

  const isFree = form.watch("is_free");
  const pricingAtSite = form.watch("pricing_at_site");
  const isRecurring = form.watch("is_recurring");

  const onSubmit = async (data: EventFormData) => {
    setIsLoading(true);

    try {
      // Combine date and time
      const [startHours, startMinutes] = data.start_time.split(":").map(Number);
      const startDateTime = new Date(data.start_date);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      let endDateTime: Date | null = null;
      if (data.end_date && data.end_time) {
        const [endHours, endMinutes] = data.end_time.split(":").map(Number);
        endDateTime = new Date(data.end_date);
        endDateTime.setHours(endHours, endMinutes, 0, 0);
      }

      // Resolve venue: reuse selected or create new
      let venueId: string | null = selectedVenueId;
      if (!venueId && data.venue_name) {
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .insert({
            name: data.venue_name,
            city: data.venue_city || null,
            address_line_1: data.venue_address || null,
          })
          .select("id")
          .single();

        if (venueError) throw venueError;
        venueId = venueData.id;
      }

      // Resolve host: reuse selected or create new
      let hostId: string | null = selectedHostId;
      if (!hostId && data.host_name) {
        const { data: hostData, error: hostError } = await supabase
          .from("hosts")
          .insert({
            name: data.host_name,
            source: "manual",
          })
          .select("id")
          .single();

        if (hostError) throw hostError;
        hostId = hostData.id;
      }

      // Create parent event
      const { data: parentEvent, error: eventError } = await supabase.from("events").insert({
        title: data.title,
        description: data.description || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString() || null,
        category_id: data.category_id || null,
        venue_id: venueId,
        host_id: hostId,
        image_url: data.image_url || null,
        ticket_url: data.ticket_url || null,
        source_url: data.source_url || null,
        is_free: data.is_free,
        pricing_at_site: data.pricing_at_site,
        featured: data.featured,
        price_min: (data.is_free || data.pricing_at_site) ? null : (data.price_min || null),
        price_max: (data.is_free || data.pricing_at_site) ? null : (data.price_max || null),
        status: "draft",
        source: "manual",
        is_recurring: data.is_recurring,
        recurrence_frequency: data.is_recurring ? (data.recurrence_frequency || null) : null,
        recurrence_until: data.is_recurring && data.recurrence_until ? data.recurrence_until.toISOString() : null,
      }).select("id").single();

      if (eventError) throw eventError;

      // Auto-generate recurring instances
      if (data.is_recurring && data.recurrence_frequency && data.recurrence_until && parentEvent) {
        const instances: Database["public"]["Tables"]["events"]["Insert"][] = [];
        const eventDuration = endDateTime ? endDateTime.getTime() - startDateTime.getTime() : null;
        let currentStart = new Date(startDateTime);

        const getNextDate = (date: Date, freq: string) => {
          switch (freq) {
            case "daily": return addDays(date, 1);
            case "weekly": return addWeeks(date, 1);
            case "biweekly": return addWeeks(date, 2);
            case "monthly": return addMonths(date, 1);
            default: return addDays(date, 7);
          }
        };

        // Generate instances (skip the first one — that's the parent)
        currentStart = getNextDate(currentStart, data.recurrence_frequency);
        while (currentStart <= data.recurrence_until) {
          const instanceEnd = eventDuration ? new Date(currentStart.getTime() + eventDuration) : null;
          instances.push({
            title: data.title,
            description: data.description || null,
            start_time: currentStart.toISOString(),
            end_time: instanceEnd?.toISOString() || null,
            category_id: data.category_id || null,
            venue_id: venueId,
            image_url: data.image_url || null,
            ticket_url: data.ticket_url || null,
            source_url: data.source_url || null,
            is_free: data.is_free,
            pricing_at_site: data.pricing_at_site,
            featured: false,
            price_min: (data.is_free || data.pricing_at_site) ? null : (data.price_min || null),
            price_max: (data.is_free || data.pricing_at_site) ? null : (data.price_max || null),
            status: "draft",
            source: "manual",
            is_recurring: true,
            recurrence_frequency: data.recurrence_frequency,
            parent_event_id: parentEvent.id,
          });
          currentStart = getNextDate(currentStart, data.recurrence_frequency);
        }

        if (instances.length > 0) {
          const { error: instancesError } = await supabase.from("events").insert(instances);
          if (instancesError) throw instancesError;
        }

        toast.success(`Event created with ${instances.length + 1} occurrences`);
      } else {
        toast.success("Event created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
      form.reset();
      setSelectedVenueId(null);
      setSelectedHostId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create event");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            Manually add a new event. Perfect for Facebook events or any source that can't be auto-imported.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Event description..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Optional</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category */}
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background border border-border z-50">
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Venue */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Venue (optional)</Label>
              <p className="text-xs text-muted-foreground">Search existing venues or enter a new one</p>
              <VenueCombobox
                name={form.watch("venue_name") || ""}
                city={form.watch("venue_city") || ""}
                address={form.watch("venue_address") || ""}
                onSelect={(venue) => setSelectedVenueId(venue?.id || null)}
                onNameChange={(v) => form.setValue("venue_name", v)}
                onCityChange={(v) => form.setValue("venue_city", v)}
                onAddressChange={(v) => form.setValue("venue_address", v)}
              />
            </div>

            {/* Host */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Host / Organizer (optional)</Label>
              <p className="text-xs text-muted-foreground">Search existing hosts or enter a new one</p>
              <HostCombobox
                name={form.watch("host_name") || ""}
                onSelect={(host) => setSelectedHostId(host?.id || null)}
                onNameChange={(v) => form.setValue("host_name", v)}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="is_free"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Free Event</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) form.setValue("pricing_at_site", false);
                      }} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pricing_at_site"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Pricing available at event site</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) form.setValue("is_free", false);
                      }} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="featured"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>⭐ Featured Event</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Recurring Event */}
              <FormField
                control={form.control}
                name="is_recurring"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>🔁 Repeating Event</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="recurrence_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background border border-border z-50">
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Biweekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recurrence_until"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Repeat Until</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : <span>End date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {!isFree && !pricingAtSite && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Price ($)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Price ($)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Event Image</Label>
              <ImageUpload
                value={form.watch("image_url") || null}
                onChange={(url) => form.setValue("image_url", url)}
              />
              <p className="text-xs text-muted-foreground">
                Upload an image or paste a URL below
              </p>
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Or paste image URL..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Other URLs */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="ticket_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Source URL (e.g., Facebook event link)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Event"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
