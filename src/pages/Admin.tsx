import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useAllEvents, useUpdateEventStatus, useDeleteEvents, Event } from "@/hooks/useEvents";
import { useSingleEvent } from "@/hooks/useSingleEvent";
import { useCategories } from "@/hooks/useCategories";
import { ImportEventDialog } from "@/components/admin/ImportEventDialog";
import { CreateEventDialog } from "@/components/admin/CreateEventDialog";
import { DataSources } from "@/components/admin/DataSources";
import { ImageUpload, type ImageUploadHandle } from "@/components/admin/ImageUpload";
import { VenueCombobox } from "@/components/admin/VenueCombobox";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { VenuesHostsTab } from "@/components/admin/VenuesHostsTab";
import { DiscoverTab } from "@/components/admin/DiscoverTab";
import { StylesTab } from "@/components/admin/StylesTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { BulkEditDialog } from "@/components/admin/BulkEditDialog";
import { NotificationsBtn } from "@/components/ui/NotificationsBtn";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Search,
  Filter,
  Check,
  X,
  Trash2,
  Edit,
  ChevronRight,
  LogIn,
  Shield,
  Plus,
  Database,
  Calendar as CalendarIcon,
  Settings,
  Palette,
  RefreshCw,
  Repeat,
  BarChart3,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type StatusFilter = "pending" | "approved" | "rejected" | "draft" | undefined;
type SourceFilter = "manual" | "eventbrite" | "meetup" | "ticketspice" | "facebook" | undefined;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800",
};

const Admin = () => {
  const { user, signIn, signOut, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("approved");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const imageUploadRef = useRef<ImageUploadHandle>(null);

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const { data: events, isLoading } = useAllEvents({
    status: statusFilter,
    source: sourceFilter,
    search: searchQuery || undefined,
  });

  const categoriesQuery = useCategories();

  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { data: directEvent } = useSingleEvent(editId || undefined);

  useEffect(() => {
    // Priority 1: Check if the event is already in the main events list
    if (editId && events && !editingEvent) {
      const eventToEdit = events.find((e) => e.id === editId);
      if (eventToEdit) {
        setEditingEvent(eventToEdit);
        clearEditParam();
        return;
      }
    }

    // Priority 2: Use the direct fetch if the list doesn't contain it (e.g. filtered)
    if (editId && directEvent && !editingEvent) {
      setEditingEvent(directEvent as any);
      clearEditParam();
    }
  }, [editId, events, directEvent, editingEvent]);

  const clearEditParam = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("edit");
    setSearchParams(newParams, { replace: true });
  };

  const updateStatus = useUpdateEventStatus();
  const deleteEvents = useDeleteEvents();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await signIn(email, password);
    if (error) setAuthError(error.message);
  };

  const toggleSelectEvent = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (events) {
      setSelectedEvents(new Set(events.map((e) => e.id)));
    }
  };

  const clearSelection = () => {
    setSelectedEvents(new Set());
  };

  const handleBulkApprove = async () => {
    if (selectedEvents.size === 0) return;
    await updateStatus.mutateAsync({ eventIds: Array.from(selectedEvents), status: "approved" });
    clearSelection();
  };

  const handleBulkReject = async () => {
    if (selectedEvents.size === 0) return;
    await updateStatus.mutateAsync({ eventIds: Array.from(selectedEvents), status: "rejected" });
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.size === 0) return;
    await deleteEvents.mutateAsync(Array.from(selectedEvents));
    clearSelection();
  };

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse-soft text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <AppLayout>
        <PageHeader title="Admin" subtitle="Sign in to manage events" />
        <div className="p-4 max-w-sm mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="admin-panel p-6"
          >
            <div className="w-16 h-16 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
              <LogIn className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-center mb-6">
              Sign In
            </h2>

            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  // Logged in but not admin
  if (!isAdmin) {
    return (
      <AppLayout>
        <PageHeader title="Admin" subtitle="Access restricted" />
        <div className="p-4 text-center py-20">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
              <Shield className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-4">
              Your account doesn't have admin privileges.
            </p>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Admin" subtitle={`${events?.length || 0} events`}>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={signOut}>
            Sign Out
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsImportOpen(true)}>
            Import
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
        <NotificationsBtn />
      </PageHeader>
      <Tabs defaultValue="events" className="w-full">
        <div className="px-4 border-b border-border bg-background">
          <TabsList className="mb-[-1px] h-12 bg-transparent p-0">
            <TabsTrigger value="events" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="discover" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <Sparkles className="mr-2 h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="sources" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <Database className="mr-2 h-4 w-4" />
              Data Sources
            </TabsTrigger>
            <TabsTrigger value="venues-hosts" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <MapPin className="mr-2 h-4 w-4" />
              Venues & Hosts
            </TabsTrigger>
            <TabsTrigger value="settings" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="styles" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <Palette className="mr-2 h-4 w-4" />
              Styles
            </TabsTrigger>
            <TabsTrigger value="analytics" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="events" className="m-0">
          {/* Filters */}
          <div className="sticky top-[73px] bg-background/95 backdrop-blur-md z-30 border-b border-border p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {(["pending", "approved", "rejected", "draft"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? undefined : status)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors",
                    statusFilter === status
                      ? statusColors[status]
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Bulk Actions */}
            {selectedEvents.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-secondary rounded-xl"
              >
                <span className="text-sm font-medium flex-1">
                  {selectedEvents.size} selected
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleBulkApprove}
                  disabled={updateStatus.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleBulkReject}
                  disabled={updateStatus.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsBulkEditOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={handleBulkDelete}
                  disabled={deleteEvents.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </div>

          {/* Event List */}
          <div className="p-4 space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))
            ) : events && events.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={selectedEvents.size === events.length ? clearSelection : selectAll}
                    className="text-sm text-primary font-medium"
                  >
                    {selectedEvents.size === events.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="admin-panel p-3 flex items-center gap-3"
                  >
                    <Checkbox
                      checked={selectedEvents.has(event.id)}
                      onCheckedChange={() => toggleSelectEvent(event.id)}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setEditingEvent(event)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("status-badge", event.status)}>
                          {event.status}
                        </span>
                        {event.featured && (
                          <span className="text-xs">⭐</span>
                        )}
                        {(event as any).is_recurring && (
                          <span className="text-xs flex items-center gap-0.5 text-primary">
                            <Repeat className="h-3 w-3" />
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground capitalize">
                          {event.source}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm truncate">{event.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "MMM d, yyyy")}
                        {event.venue?.name && ` • ${event.venue.name}`}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </motion.div>
                ))}
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No events found</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="discover" className="p-0 m-0">
          <DiscoverTab />
        </TabsContent>

        <TabsContent value="sources" className="p-4 m-0">
          <DataSources />
        </TabsContent>

        <TabsContent value="venues-hosts" className="p-0 m-0">
          <VenuesHostsTab />
        </TabsContent>

        <TabsContent value="settings" className="p-0 m-0">
          <SettingsTab />
        </TabsContent>

        <TabsContent value="styles" className="p-0 m-0">
          <StylesTab />
        </TabsContent>

        <TabsContent value="analytics" className="p-0 m-0">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>

      {/* Quick Edit Drawer */}
      <Sheet open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl flex flex-col p-0 gap-0">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle>Edit Event</SheetTitle>
          </SheetHeader>
          {editingEvent && (
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
              {editingEvent.image_url && (
                <div className="relative">
                  <ImageUpload
                    ref={imageUploadRef}
                    value={editingEvent.image_url}
                    cropEnabled
                    onChange={(url) => {
                      // Update local state to show change immediately
                      setEditingEvent({ ...editingEvent, image_url: url });
                    }}
                  />
                </div>
              )}
              {/* If no image, show uploader too */}
              {!editingEvent.image_url && (
                <ImageUpload
                  ref={imageUploadRef}
                  value={null}
                  cropEnabled
                  onChange={(url) => setEditingEvent({ ...editingEvent, image_url: url })}
                />
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <Input
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    className="font-semibold text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex gap-2">
                    {(["pending", "approved", "rejected"] as const).map((status) => (
                      <Button
                        key={status}
                        variant={editingEvent.status === status ? "default" : "outline"}
                        size="sm"
                        className="capitalize"
                        onClick={() => {
                          updateStatus.mutate({ eventIds: [editingEvent.id], status });
                          setEditingEvent({ ...editingEvent, status });
                        }}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Host</label>
                  <Input
                    placeholder="Host Name"
                    value={editingEvent.host?.name || ''}
                    onChange={(e) => {
                      const newHost = { ...(editingEvent.host || { id: '' }), name: e.target.value };
                      setEditingEvent({ ...editingEvent, host: newHost as any });
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Start Time</label>
                    <Input
                      type="datetime-local"
                      value={editingEvent.start_time ? format(new Date(editingEvent.start_time), "yyyy-MM-dd'T'HH:mm") : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEditingEvent({ ...editingEvent, start_time: new Date(e.target.value).toISOString() });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">End Time</label>
                    <Input
                      type="datetime-local"
                      value={editingEvent.end_time ? format(new Date(editingEvent.end_time), "yyyy-MM-dd'T'HH:mm") : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEditingEvent({ ...editingEvent, end_time: new Date(e.target.value).toISOString() });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Venue Details</label>
                  <p className="text-xs text-muted-foreground">Search existing venues or enter new details</p>
                  <VenueCombobox
                    name={editingEvent.venue?.name || ''}
                    city={editingEvent.venue?.city || ''}
                    address={(editingEvent.venue as any)?.address_line_1 || ''}
                    onSelect={(venue) => {
                      if (venue) {
                        setEditingEvent({ ...editingEvent, venue: venue as any });
                      } else {
                        // Clear venue id when typing new name
                        const newVenue = { ...(editingEvent.venue || {}), id: undefined };
                        setEditingEvent({ ...editingEvent, venue: newVenue as any });
                      }
                    }}
                    onNameChange={(v) => {
                      const newVenue = { ...(editingEvent.venue || {}), name: v };
                      setEditingEvent({ ...editingEvent, venue: newVenue as any });
                    }}
                    onCityChange={(v) => {
                      const newVenue = { ...(editingEvent.venue || {}), city: v };
                      setEditingEvent({ ...editingEvent, venue: newVenue as any });
                    }}
                    onAddressChange={(v) => {
                      const newVenue = { ...(editingEvent.venue || {}), address_line_1: v };
                      setEditingEvent({ ...editingEvent, venue: newVenue as any });
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Address Line 2"
                      value={(editingEvent.venue as any)?.address_line_2 || ''}
                      onChange={(e) => {
                        const newVenue = { ...(editingEvent.venue || {}), address_line_2: e.target.value };
                        setEditingEvent({ ...editingEvent, venue: newVenue as any });
                      }}
                    />
                    <Input
                      placeholder="State"
                      value={(editingEvent.venue as any)?.state || ''}
                      onChange={(e) => {
                        const newVenue = { ...(editingEvent.venue || {}), state: e.target.value };
                        setEditingEvent({ ...editingEvent, venue: newVenue as any });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Zip"
                      value={(editingEvent.venue as any)?.postal_code || ''}
                      onChange={(e) => {
                        const newVenue = { ...(editingEvent.venue || {}), postal_code: e.target.value };
                        setEditingEvent({ ...editingEvent, venue: newVenue as any });
                      }}
                    />
                    <Input
                      placeholder="Google Maps Link"
                      value={(editingEvent.venue as any)?.map_url || ''}
                      onChange={(e) => {
                        const newVenue = { ...(editingEvent.venue || {}), map_url: e.target.value };
                        setEditingEvent({ ...editingEvent, venue: newVenue as any });
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Price Min ($)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editingEvent.price_min ?? ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, price_min: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Price Max ($)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editingEvent.price_max ?? ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, price_max: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <Checkbox
                    id="is_free"
                    checked={!!editingEvent.is_free}
                    onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, is_free: !!checked, ...( checked ? { pricing_at_site: false } : {}) } as any)}
                  />
                  <label htmlFor="is_free" className="text-sm font-medium cursor-pointer">This is a free event</label>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <Checkbox
                    id="pricing_at_site"
                    checked={!!(editingEvent as any).pricing_at_site}
                    onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, pricing_at_site: !!checked, ...( checked ? { is_free: false } : {}) } as any)}
                  />
                  <label htmlFor="pricing_at_site" className="text-sm font-medium cursor-pointer">Pricing available at event site</label>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <Checkbox
                    id="is_featured"
                    checked={!!editingEvent.featured}
                    onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, featured: !!checked })}
                  />
                  <label htmlFor="is_featured" className="text-sm font-medium cursor-pointer">⭐ Featured event</label>
                </div>

                {/* Recurring controls */}
                <div className="flex items-center gap-2 py-2">
                  <Checkbox
                    id="is_recurring"
                    checked={!!(editingEvent as any).is_recurring}
                    onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, is_recurring: !!checked } as any)}
                  />
                  <label htmlFor="is_recurring" className="text-sm font-medium cursor-pointer">🔁 Repeating event</label>
                </div>

                {(editingEvent as any).is_recurring && (
                  <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Frequency</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={(editingEvent as any).recurrence_frequency || ""}
                        onChange={(e) => setEditingEvent({ ...editingEvent, recurrence_frequency: e.target.value || null } as any)}
                      >
                        <option value="">Select frequency</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Repeat Until</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !(editingEvent as any).recurrence_until && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {(editingEvent as any).recurrence_until
                              ? format(new Date((editingEvent as any).recurrence_until), "PPP")
                              : "Pick end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={(editingEvent as any).recurrence_until ? new Date((editingEvent as any).recurrence_until) : undefined}
                            onSelect={(date) => setEditingEvent({ ...editingEvent, recurrence_until: date ? date.toISOString() : null } as any)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Edit all instances button */}
                    {(editingEvent as any).parent_event_id || (editingEvent as any).is_recurring ? (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={async () => {
                            const parentId = (editingEvent as any).parent_event_id || editingEvent.id;
                            let imageUrl = editingEvent.image_url;
                            try {
                              imageUrl = await imageUploadRef.current?.applyCrop() || imageUrl;
                            } catch {
                              return;
                            }
                            // Update all instances with the same parent
                            const { error } = await supabase
                              .from("events")
                              .update({
                                title: editingEvent.title,
                                description: editingEvent.description,
                                image_url: imageUrl,
                                ticket_url: editingEvent.ticket_url,
                                price_min: editingEvent.price_min,
                                price_max: editingEvent.price_max,
                                is_free: editingEvent.is_free,
                                status: editingEvent.status,
                              } as any)
                              .or(`id.eq.${parentId},parent_event_id.eq.${parentId}`);
                            if (error) {
                              toast.error("Failed to update all instances");
                              console.error(error);
                            } else {
                              toast.success("Updated all recurring instances");
                              queryClient.invalidateQueries({ queryKey: ["events"] });
                            }
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Update All Instances
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            const parentId = (editingEvent as any).parent_event_id || editingEvent.id;
                            // Delete all instances with the same parent
                            const { error: err1 } = await supabase
                              .from("events")
                              .delete()
                              .eq("parent_event_id", parentId);
                            const { error: err2 } = await supabase
                              .from("events")
                              .delete()
                              .eq("id", parentId);
                            if (err1 || err2) {
                              toast.error("Failed to delete all instances");
                            } else {
                              toast.success("Deleted all recurring instances");
                              setEditingEvent(null);
                              queryClient.invalidateQueries({ queryKey: ["events"] });
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete All Instances
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Ticket URL</label>
                  <Input
                    placeholder="https://..."
                    value={editingEvent.ticket_url || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, ticket_url: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Categories</label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-[150px] overflow-y-auto">
                    {categoriesQuery.data?.map((cat) => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${cat.id}`}
                          checked={editingEvent.event_categories?.some(ec => ec.category.id === cat.id) || false}
                          onCheckedChange={(checked) => {
                            let newEC = [...(editingEvent.event_categories || [])];
                            if (checked) {
                              newEC.push({ category: cat });
                            } else {
                              newEC = newEC.filter(ec => ec.category.id !== cat.id);
                            }
                            setEditingEvent({ ...editingEvent, event_categories: newEC });
                          }}
                        />
                        <label
                          htmlFor={`cat-${cat.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                        >
                          <span>{cat.icon}</span>
                          {cat.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <Textarea
                    value={editingEvent.description || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                    className="min-h-[150px]"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-2 pb-6">
                {editingEvent.source_url && (
                  <Button
                    variant="outline"
                    disabled={isRefreshing}
                    onClick={async () => {
                      setIsRefreshing(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('import-event', {
                          body: { url: editingEvent.source_url }
                        });

                        if (error) throw error;

                        // Merge new data into editingEvent
                        setEditingEvent((prev) => prev ? ({
                          ...prev,
                          title: data.title || prev.title,
                          description: data.description || prev.description,
                          start_time: data.start_time || prev.start_time,
                          end_time: data.end_time || prev.end_time,
                          image_url: data.image_url || prev.image_url,
                          price_min: data.price_min !== undefined ? data.price_min : prev.price_min,
                          price_max: data.price_max !== undefined ? data.price_max : prev.price_max,
                          is_free: data.is_free !== undefined ? data.is_free : prev.is_free,
                          ticket_url: data.ticket_url || prev.ticket_url,
                          venue: {
                            ...prev.venue, // Keep existing ID
                            name: data.location || prev.venue?.name,
                            address_line_1: data.address || (prev.venue as any)?.address_line_1,
                            map_url: data.google_maps_link || (prev.venue as any)?.map_url
                          } as any,
                          host: {
                            ...prev.host, // Keep existing ID
                            name: data.organizer || prev.host?.name
                          } as any
                        }) : null);

                        toast.success("Refreshed details from source");
                      } catch (error) {
                        console.error("Refresh failed:", error);
                        toast.error("Failed to refresh: " + (error as any).message);
                      } finally {
                        setIsRefreshing(false);
                      }
                    }}
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Refreshing..." : "Refresh Data"}
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={async () => {
                    let imageUrl = editingEvent.image_url;
                    try {
                      imageUrl = await imageUploadRef.current?.applyCrop() || imageUrl;
                    } catch {
                      return;
                    }
                    // 1. Update Event Fields
                    const { error: eventError } = await supabase.from('events').update({
                      image_url: imageUrl,
                      title: editingEvent.title,
                      description: editingEvent.description,
                      start_time: editingEvent.start_time,
                      end_time: editingEvent.end_time,
                      price_min: editingEvent.price_min,
                      price_max: editingEvent.price_max,
                      is_free: editingEvent.is_free,
                      pricing_at_site: (editingEvent as any).pricing_at_site || false,
                      ticket_url: editingEvent.ticket_url,
                      featured: editingEvent.featured,
                      is_recurring: (editingEvent as any).is_recurring || false,
                      recurrence_frequency: (editingEvent as any).recurrence_frequency || null,
                    } as any).eq('id', editingEvent.id);

                    // 2. Update or Create Venue
                    if (!eventError && editingEvent.venue?.name) {
                      if (editingEvent.venue.id) {
                        // Update existing venue
                        const { error: venueError } = await supabase.from('venues').update({
                          name: editingEvent.venue.name,
                          address_line_1: (editingEvent.venue as any).address_line_1,
                          address_line_2: (editingEvent.venue as any).address_line_2,
                          city: editingEvent.venue.city,
                          state: (editingEvent.venue as any).state,
                          postal_code: (editingEvent.venue as any).postal_code,
                          map_url: (editingEvent.venue as any).map_url
                        }).eq('id', editingEvent.venue.id);
                        if (venueError) console.error("Failed to update venue:", venueError);
                      } else {
                        // Create new venue and link to event
                        const { data: newVenue, error: venueError } = await supabase.from('venues').insert({
                          name: editingEvent.venue.name,
                          address_line_1: (editingEvent.venue as any).address_line_1 || null,
                          address_line_2: (editingEvent.venue as any).address_line_2 || null,
                          city: editingEvent.venue.city || null,
                          state: (editingEvent.venue as any).state || null,
                          postal_code: (editingEvent.venue as any).postal_code || null,
                          map_url: (editingEvent.venue as any).map_url || null
                        }).select('id').single();
                        if (venueError) {
                          console.error("Failed to create venue:", venueError);
                        } else {
                          await supabase.from('events').update({ venue_id: newVenue.id }).eq('id', editingEvent.id);
                        }
                      }
                    }

                    // 3. Update or Create Host
                    if (!eventError && editingEvent.host?.name) {
                      if (editingEvent.host.id) {
                        const { error: hostError } = await supabase.from('hosts').update({
                          name: editingEvent.host.name
                        }).eq('id', editingEvent.host.id);
                        if (hostError) console.error("Failed to update host:", hostError);
                      } else {
                        const { data: newHost, error: hostError } = await supabase.from('hosts').insert({
                          name: editingEvent.host.name,
                          source: 'manual' as const,
                        }).select('id').single();
                        if (hostError) {
                          console.error("Failed to create host:", hostError);
                        } else {
                          await supabase.from('events').update({ host_id: newHost.id }).eq('id', editingEvent.id);
                        }
                      }
                    }

                    // 4. Update Categories (Delete all, then insert new)
                    if (!eventError && editingEvent.event_categories) {
                      try {
                        // Delete existing
                        await supabase.from('event_categories').delete().eq('event_id', editingEvent.id);

                        // Insert new
                        const newAssociations = editingEvent.event_categories.map(ec => ({
                          event_id: editingEvent.id,
                          category_id: ec.category.id
                        }));

                        if (newAssociations.length > 0) {
                          const { error: catError } = await supabase.from('event_categories').insert(newAssociations);
                          if (catError) throw catError;
                        }
                      } catch (err) {
                        console.error("Failed to update categories:", err);
                      }
                    }

                    if (!eventError) {
                      toast.success("Event updated");
                      setEditingEvent(null);
                      queryClient.invalidateQueries({ queryKey: ["events"] });
                    } else {
                      toast.error("Failed to update event");
                      console.error(eventError);
                    }
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    deleteEvents.mutate([editingEvent.id]);
                    setEditingEvent(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {/* Import Dialog */}
      <ImportEventDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      {/* Create Dialog */}
      <CreateEventDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
        selectedEventIds={Array.from(selectedEvents)}
        onSuccess={clearSelection}
      />
    </AppLayout>
  );
};

export default Admin;
