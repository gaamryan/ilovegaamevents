import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";

interface PreviewRow {
  event_id: string;
  title: string;
  start_time: string;
  suggested: { category_id: string; slug: string; matched_keyword: string }[];
}

interface RowState {
  checked: boolean;
  categoryIds: string[];
}

export function usePreviewAutoCategorization(upcomingOnly: boolean, enabled = true) {
  return useQuery({
    queryKey: ["preview-auto-categorization", upcomingOnly],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_auto_categorization", { _upcoming_only: upcomingOnly });
      if (error) throw error;
      return (data ?? []) as unknown as PreviewRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function AutoCategorizeReviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [includePast, setIncludePast] = useState(false);
  const { data: rows, isLoading } = usePreviewAutoCategorization(!includePast, open);
  const { data: categories } = useCategories();
  const [state, setState] = useState<Record<string, RowState>>({});
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!rows) return;
    const next: Record<string, RowState> = {};
    for (const r of rows) next[r.event_id] = { checked: true, categoryIds: r.suggested.map((s) => s.category_id) };
    setState(next);
  }, [rows]);

  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const selectedCount = Object.values(state).filter((s) => s.checked && s.categoryIds.length > 0).length;
  const allChecked = rows && rows.length > 0 && rows.every((r) => state[r.event_id]?.checked);

  const update = (id: string, fn: (s: RowState) => RowState) =>
    setState((prev) => ({ ...prev, [id]: fn(prev[id] ?? { checked: true, categoryIds: [] }) }));

  const apply = async () => {
    const links: { event_id: string; category_id: string; auto_assigned: boolean }[] = [];
    let events = 0;
    for (const [eventId, s] of Object.entries(state)) {
      if (!s.checked || s.categoryIds.length === 0) continue;
      events++;
      for (const cid of s.categoryIds) links.push({ event_id: eventId, category_id: cid, auto_assigned: true });
    }
    if (!links.length) return;
    setApplying(true);
    const { error } = await supabase
      .from("event_categories")
      .upsert(links, { onConflict: "event_id,category_id", ignoreDuplicates: true });
    setApplying(false);
    if (error) {
      console.error(error);
      toast.error("Failed to apply categories");
      return;
    }
    toast.success(`Tagged ${events} event${events === 1 ? "" : "s"}`);
    qc.invalidateQueries({ queryKey: ["preview-auto-categorization"] });
    qc.invalidateQueries({ queryKey: ["admin-category-stats"] });
    qc.invalidateQueries({ queryKey: ["category-upcoming-counts"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review category suggestions</DialogTitle>
          <DialogDescription>Uncategorized events with keyword matches. Nothing is saved until you apply.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            className="text-sm text-primary font-medium"
            onClick={() =>
              setState((prev) => {
                const next: Record<string, RowState> = {};
                for (const [k, v] of Object.entries(prev)) next[k] = { ...v, checked: !allChecked };
                return next;
              })
            }
          >
            {allChecked ? "Select none" : "Select all"}
          </button>
          <div className="flex items-center gap-2">
            <Switch id="incl-past" checked={includePast} onCheckedChange={setIncludePast} />
            <Label htmlFor="incl-past" className="text-sm">Include past events</Label>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No suggestions right now.</p>
          ) : (
            rows.map((r) => {
              const s = state[r.event_id] ?? { checked: true, categoryIds: [] };
              const matched = new Map(r.suggested.map((x) => [x.category_id, x.matched_keyword]));
              return (
                <div key={r.event_id} className="admin-panel p-3 flex gap-3 items-start">
                  <Checkbox
                    className="mt-1"
                    checked={s.checked}
                    onCheckedChange={(c) => update(r.event_id, (p) => ({ ...p, checked: !!c }))}
                    aria-label={`Include ${r.title}`}
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div>
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(r.start_time), "EEE, MMM d, yyyy")}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {s.categoryIds.map((cid) => {
                        const c = catById.get(cid);
                        const kw = matched.get(cid);
                        return (
                          <span
                            key={cid}
                            title={kw ? `Matched "${kw}"` : "Added by you"}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                          >
                            {c?.icon} {c?.name ?? cid}
                            {kw && <span className="text-[10px] text-muted-foreground">({kw})</span>}
                            <button
                              type="button"
                              aria-label={`Remove ${c?.name}`}
                              onClick={() => update(r.event_id, (p) => ({ ...p, categoryIds: p.categoryIds.filter((x) => x !== cid) }))}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                      <Select
                        value=""
                        onValueChange={(cid) =>
                          update(r.event_id, (p) => (p.categoryIds.includes(cid) ? p : { ...p, categoryIds: [...p.categoryIds, cid] }))
                        }
                      >
                        <SelectTrigger className="h-6 w-auto text-xs px-2 gap-1">
                          <SelectValue placeholder="+ Add" />
                        </SelectTrigger>
                        <SelectContent>
                          {(categories ?? [])
                            .filter((c) => !s.categoryIds.includes(c.id))
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.icon} {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={apply} disabled={applying || selectedCount === 0}>
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply selected ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
