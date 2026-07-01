import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, ExternalLink, AlertTriangle, DownloadCloud } from "lucide-react";
import {
  useDiscoverEvents,
  importDiscoveredAsDraft,
  type DiscoverSource,
  type DiscoveredEvent,
} from "@/hooks/useDiscoverEvents";
import { DISCOVERY_PRESETS, presetToKeyword } from "@/lib/discovery-presets";

export function DiscoverTab() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<DiscoverSource>("eventbrite");
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [fbUrl, setFbUrl] = useState("");
  const [results, setResults] = useState<DiscoveredEvent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const discover = useDiscoverEvents();

  const handleSearch = async () => {
    setResults([]);
    setSelected(new Set());
    try {
      const data = await discover.mutateAsync({
        source,
        keyword: keyword || undefined,
        city: city || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        fb_url: source === "facebook" ? fbUrl : undefined,
      });
      setResults(data);
      if (data.length === 0) toast.info("No events found. Try broader terms.");
      else toast.success(`Found ${data.length} event${data.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message || "Discovery failed");
    }
  };

  const toggle = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(r => r.source_url)));
  };

  const handleImport = async () => {
    const toImport = results.filter(r => selected.has(r.source_url));
    if (toImport.length === 0) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const ev of toImport) {
      try {
        await importDiscoveredAsDraft(ev);
        ok++;
      } catch (e) {
        console.error("import failed", e);
        fail++;
      }
    }
    setImporting(false);
    if (ok) toast.success(`Imported ${ok} draft${ok === 1 ? "" : "s"}`);
    if (fail) toast.error(`${fail} failed to import`);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setResults(prev => prev.filter(r => !selected.has(r.source_url)));
      setSelected(new Set());
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Discover Events</h2>
        <p className="text-sm text-muted-foreground">
          Search Eventbrite, Meetup, Facebook, or the open web. Selected results import as drafts.
        </p>
      </div>

      {/* Search controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <Select value={source} onValueChange={(v) => setSource(v as DiscoverSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eventbrite">Eventbrite</SelectItem>
                  <SelectItem value="meetup">Meetup</SelectItem>
                  <SelectItem value="facebook">Facebook Page/Group</SelectItem>
                  <SelectItem value="web">Web Search</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {source === "facebook" ? (
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Facebook Page or Group URL</label>
                <Input
                  placeholder="https://www.facebook.com/venuename"
                  value={fbUrl}
                  onChange={(e) => setFbUrl(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Keyword</label>
                  <Input placeholder="e.g. comedy, cosplay, trivia" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">City</label>
                  <Input placeholder="e.g. Tampa" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">From</label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          {source !== "facebook" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category presets</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DISCOVERY_PRESETS.map(p => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setKeyword(presetToKeyword(p))}
                  >
                    <span className="mr-1">{p.emoji}</span> {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSearch} disabled={discover.isPending || (source === "facebook" && !fbUrl)}>
              {discover.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {discover.isPending ? "Searching…" : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === results.length && results.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm text-muted-foreground">
                {selected.size} of {results.length} selected
              </span>
            </div>
            <Button onClick={handleImport} disabled={selected.size === 0 || importing}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
              Import as Draft{selected.size > 1 ? "s" : ""}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map((r) => {
              const isDup = !!r.duplicate_of;
              const isSel = selected.has(r.source_url);
              return (
                <Card
                  key={r.source_url}
                  className={`transition ${isSel ? "ring-2 ring-primary" : ""} ${isDup ? "border-yellow-400/60" : ""}`}
                >
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="pt-1">
                        <Checkbox checked={isSel} onCheckedChange={() => toggle(r.source_url)} />
                      </div>
                      {r.image_url && (
                        <img
                          src={r.image_url}
                          alt=""
                          className="w-20 h-20 rounded object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm line-clamp-2">{r.title}</h3>
                          <Badge variant="outline" className="capitalize text-[10px] flex-shrink-0">
                            {r.source}
                          </Badge>
                        </div>
                        {r.start_time && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(r.start_time), "MMM d, yyyy · h:mm a")}
                          </p>
                        )}
                        {r.venue?.name && (
                          <p className="text-xs text-muted-foreground truncate">
                            📍 {r.venue.name}{r.venue.city ? `, ${r.venue.city}` : ""}
                          </p>
                        )}
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                        )}
                        {isDup && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400">
                            <AlertTriangle className="h-3 w-3" />
                            Possible duplicate of "{r.duplicate_of!.title}" ({Math.round(r.duplicate_of!.score * 100)}%)
                          </div>
                        )}
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          View source <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
