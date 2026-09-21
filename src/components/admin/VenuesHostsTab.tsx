import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search,
  Pencil,
  Trash2,
  Plus,
  Upload,
  MapPin,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Venue types ───
interface Venue {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  map_url: string | null;
  created_at: string | null;
}

// ─── Host types ───
interface Host {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  source: Database["public"]["Enums"]["event_source"] | null;
  created_at: string | null;
}

// ─── Hooks ───
function useVenues() {
  return useQuery({
    queryKey: ["admin-venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Venue[];
    },
  });
}

function useHosts() {
  return useQuery({
    queryKey: ["admin-hosts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hosts")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Host[];
    },
  });
}

// ─── Main component ───
export function VenuesHostsTab() {
  const [tab, setTab] = useState<"venues" | "hosts">("venues");

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={tab === "venues" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("venues")}
          className="gap-1.5"
        >
          <MapPin className="h-4 w-4" /> Venues
        </Button>
        <Button
          variant={tab === "hosts" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("hosts")}
          className="gap-1.5"
        >
          <User className="h-4 w-4" /> Hosts
        </Button>
      </div>

      {tab === "venues" ? <VenuesSection /> : <HostsSection />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  VENUES SECTION
// ═══════════════════════════════════════════

function VenuesSection() {
  const { data: venues, isLoading } = useVenues();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    if (!venues) return [];
    if (!search) return venues;
    const q = search.toLowerCase();
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.address_line_1?.toLowerCase().includes(q)
    );
  }, [venues, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((v) => v.id)));
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} venue(s)? Events linked to these venues will lose their venue.`)) return;
    const { error } = await supabase.from("venues").delete().in("id", ids);
    if (error) {
      toast.error("Failed to delete venues");
    } else {
      toast.success(`Deleted ${ids.length} venue(s)`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
    }
  };

  const handleSave = async (venue: Venue) => {
    const { id, created_at, ...fields } = venue;
    const { error } = await supabase.from("venues").update(fields).eq("id", id);
    if (error) {
      toast.error("Failed to update venue");
    } else {
      toast.success("Venue updated");
      setEditingVenue(null);
      queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4" /> Bulk Import
        </Button>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={() => handleDelete(Array.from(selected))}
          >
            <Trash2 className="h-4 w-4" /> Delete ({selected.size})
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} venues</p>

      <div className="rounded-md border overflow-auto max-h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((venue) => (
              <TableRow key={venue.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(venue.id)}
                    onCheckedChange={() => toggleSelect(venue.id)}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[250px] truncate">{venue.name}</TableCell>
                <TableCell>{venue.city || "—"}</TableCell>
                <TableCell>{venue.state || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingVenue(venue)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete([venue.id])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No venues found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingVenue && (
        <EditVenueDialog
          venue={editingVenue}
          onClose={() => setEditingVenue(null)}
          onSave={handleSave}
        />
      )}

      {/* Bulk Import Dialog */}
      {showImport && (
        <BulkImportDialog
          type="venues"
          onClose={() => setShowImport(false)}
          onComplete={() => {
            setShowImport(false);
            queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
          }}
        />
      )}
    </>
  );
}

function EditVenueDialog({
  venue,
  onClose,
  onSave,
}: {
  venue: Venue;
  onClose: () => void;
  onSave: (v: Venue) => void;
}) {
  const [form, setForm] = useState(venue);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Venue</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Address Line 1"
            value={form.address_line_1 || ""}
            onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
          />
          <Input
            placeholder="Address Line 2"
            value={form.address_line_2 || ""}
            onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="City"
              value={form.city || ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Input
              placeholder="State"
              value={form.state || ""}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
            <Input
              placeholder="Zip"
              value={form.postal_code || ""}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            />
          </div>
          <Input
            placeholder="Google Maps Link"
            value={form.map_url || ""}
            onChange={(e) => setForm({ ...form, map_url: e.target.value })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
//  HOSTS SECTION
// ═══════════════════════════════════════════

function HostsSection() {
  const { data: hosts, isLoading } = useHosts();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    if (!hosts) return [];
    if (!search) return hosts;
    const q = search.toLowerCase();
    return hosts.filter((h) => h.name.toLowerCase().includes(q));
  }, [hosts, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((h) => h.id)));
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} host(s)? Events linked to these hosts will lose their host.`)) return;
    const { error } = await supabase.from("hosts").delete().in("id", ids);
    if (error) {
      toast.error("Failed to delete hosts");
    } else {
      toast.success(`Deleted ${ids.length} host(s)`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-hosts"] });
    }
  };

  const handleSave = async (host: Host) => {
    const { id, created_at, source, ...fields } = host;
    const { error } = await supabase.from("hosts").update({
      ...fields,
      source,
    }).eq("id", id);
    if (error) {
      toast.error("Failed to update host");
    } else {
      toast.success("Host updated");
      setEditingHost(null);
      queryClient.invalidateQueries({ queryKey: ["admin-hosts"] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search hosts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4" /> Bulk Import
        </Button>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={() => handleDelete(Array.from(selected))}
          >
            <Trash2 className="h-4 w-4" /> Delete ({selected.size})
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} hosts</p>

      <div className="rounded-md border overflow-auto max-h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((host) => (
              <TableRow key={host.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(host.id)}
                    onCheckedChange={() => toggleSelect(host.id)}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[250px] truncate">{host.name}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                  {host.website_url ? (
                    <a href={host.website_url} target="_blank" rel="noopener" className="hover:underline">
                      {host.website_url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{host.source || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingHost(host)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete([host.id])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hosts found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingHost && (
        <EditHostDialog
          host={editingHost}
          onClose={() => setEditingHost(null)}
          onSave={handleSave}
        />
      )}

      {showImport && (
        <BulkImportDialog
          type="hosts"
          onClose={() => setShowImport(false)}
          onComplete={() => {
            setShowImport(false);
            queryClient.invalidateQueries({ queryKey: ["admin-hosts"] });
          }}
        />
      )}
    </>
  );
}

function EditHostDialog({
  host,
  onClose,
  onSave,
}: {
  host: Host;
  onClose: () => void;
  onSave: (h: Host) => void;
}) {
  const [form, setForm] = useState(host);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Host</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Website URL"
            value={form.website_url || ""}
            onChange={(e) => setForm({ ...form, website_url: e.target.value || null })}
          />
          <Input
            placeholder="Logo URL"
            value={form.logo_url || ""}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value || null })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
//  BULK IMPORT DIALOG
// ═══════════════════════════════════════════

function BulkImportDialog({
  type,
  onClose,
  onComplete,
}: {
  type: "venues" | "hosts";
  onClose: () => void;
  onComplete: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);

  const placeholder =
    type === "venues"
      ? `Paste one venue per line:\nVenue Name, City, State\nVenue Name, City, State`
      : `Paste one host per line:\nHost Name\nHost Name, https://website.com`;

  const handleImport = async () => {
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error("No data to import");
      return;
    }

    setImporting(true);
    try {
      if (type === "venues") {
        const rows = lines.map((line) => {
          const parts = line.split(",").map((p) => p.trim());
          return {
            name: parts[0] || "Unknown Venue",
            city: parts[1] || null,
            state: parts[2] || null,
            address_line_1: parts[3] || null,
            postal_code: parts[4] || null,
          };
        });
        const { error } = await supabase.from("venues").insert(rows);
        if (error) throw error;
        toast.success(`Imported ${rows.length} venues`);
      } else {
        const rows = lines.map((line) => {
          const parts = line.split(",").map((p) => p.trim());
          return {
            name: parts[0] || "Unknown Host",
            website_url: parts[1] || null,
            source: "manual" as const,
          };
        });
        const { error } = await supabase.from("hosts").insert(rows);
        if (error) throw error;
        toast.success(`Imported ${rows.length} hosts`);
      }
      onComplete();
    } catch (err) {
      toast.error("Import failed: " + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import {type === "venues" ? "Venues" : "Hosts"}</DialogTitle>
          <DialogDescription>
            Paste comma-separated data, one {type === "venues" ? "venue" : "host"} per line.
            {type === "venues"
              ? " Format: Name, City, State, Address, Zip"
              : " Format: Name, Website URL"}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder={placeholder}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing} className="gap-1.5">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importing..." : `Import ${rawText.split("\n").filter(Boolean).length} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
