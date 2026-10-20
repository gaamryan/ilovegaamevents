import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Edit, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCategories, useCategoryUpcomingCounts, type Category } from "@/hooks/useCategories";
import { fetchCategorySuggestions, type CategorySuggestion } from "@/hooks/useCategorySuggestions";
import { swapSortOrder, isUncategorized } from "@/lib/categoryHelpers";
import { CategoryEditDialog } from "./CategoryEditDialog";
import { AutoCategorizeReviewDialog, usePreviewAutoCategorization } from "./AutoCategorizeReviewDialog";

function useAdminCategoryStats() {
  return useQuery({
    queryKey: ["admin-category-stats"],
    queryFn: async () => {
      const [links, upcoming] = await Promise.all([
        supabase.from("event_categories").select("category_id").limit(20000),
        (() => {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          return supabase
            .from("events")
            .select("id, event_categories(category_id)")
            .neq("status", "rejected")
            .or(`end_time.gte.${now.toISOString()},and(end_time.is.null,start_time.gte.${startOfToday})`)
            .limit(5000);
        })(),
      ]);
      if (links.error) throw links.error;
      if (upcoming.error) throw upcoming.error;
      const totals: Record<string, number> = {};
      for (const l of links.data ?? []) totals[l.category_id] = (totals[l.category_id] ?? 0) + 1;
      const uncategorizedUpcoming = (upcoming.data ?? []).filter(isUncategorized).length;
      return { totals, uncategorizedUpcoming };
    },
    staleTime: 60 * 1000,
  });
}

export function CategoriesTab() {
  const qc = useQueryClient();
  const { data: categories, isLoading } = useCategories();
  const { data: upcoming } = useCategoryUpcomingCounts();
  const { data: stats } = useAdminCategoryStats();
  const { data: preview } = usePreviewAutoCategorization(true);

  const [editing, setEditing] = useState<Category | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const [tryTitle, setTryTitle] = useState("");
  const [tryVenue, setTryVenue] = useState("");
  const [tryHost, setTryHost] = useState("");
  const [tryResult, setTryResult] = useState<CategorySuggestion[] | null>(null);

  const sorted = useMemo(() => categories ?? [], [categories]);
  const catById = useMemo(() => new Map(sorted.map((c) => [c.id, c])), [sorted]);
  const nextSort = Math.max(0, ...sorted.map((c) => c.sort_order ?? 0)) + 1;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["category-upcoming-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-category-stats"] });
    qc.invalidateQueries({ queryKey: ["preview-auto-categorization"] });
  };

  const move = async (index: number, dir: "up" | "down") => {
    const updates = swapSortOrder(sorted, index, dir);
    if (!updates) return;
    const results = await Promise.all(
      updates.map((u) => supabase.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id))
    );
    if (results.some((r) => r.error)) toast.error("Failed to reorder");
    invalidate();
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const id = deleting.id;
    const r1 = await supabase.from("event_categories").delete().eq("category_id", id);
    const r2 = await supabase.from("events").update({ category_id: null }).eq("category_id", id);
    const r3 = await supabase.from("categories").delete().eq("id", id);
    setBusy(false);
    setDeleting(null);
    if (r1.error || r2.error || r3.error) {
      console.error(r1.error || r2.error || r3.error);
      toast.error("Failed to delete category");
    } else toast.success(`Deleted ${deleting.name}`);
    invalidate();
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const runAll = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("auto_categorize_uncategorized", { _upcoming_only: true });
    setBusy(false);
    setConfirmAll(false);
    if (error) {
      console.error(error);
      toast.error("Auto-categorize failed");
      return;
    }
    toast.success(`Tagged ${data ?? 0} event${data === 1 ? "" : "s"}`);
    invalidate();
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const runTry = async () => {
    setTryResult(await fetchCategorySuggestions(tryTitle, tryVenue, tryHost));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Auto-categorization summary */}
      <div className="admin-panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Auto-categorization</h3>
        </div>
        <div className="text-sm space-y-0.5">
          <p>
            <strong>{stats?.uncategorizedUpcoming ?? "…"}</strong> upcoming events have no category
          </p>
          <p className="text-muted-foreground">
            <strong>{preview?.length ?? "…"}</strong> of those have suggestions
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setReviewOpen(true)}>Review suggestions</Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirmAll(true)}>
            <Wand2 className="h-4 w-4 mr-1" /> Auto-categorize all now
          </Button>
        </div>
      </div>

      {/* Try it */}
      <div className="admin-panel p-4 space-y-3">
        <h3 className="font-semibold text-sm">Try keywords</h3>
        <form
          className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            runTry();
          }}
        >
          <Input placeholder="Event title" value={tryTitle} onChange={(e) => setTryTitle(e.target.value)} />
          <Input placeholder="Venue (optional)" value={tryVenue} onChange={(e) => setTryVenue(e.target.value)} />
          <Input placeholder="Host (optional)" value={tryHost} onChange={(e) => setTryHost(e.target.value)} />
          <Button type="submit" size="sm" className="h-10" disabled={!tryTitle.trim()}>Try it</Button>
        </form>
        {tryResult && (
          <div className="flex flex-wrap gap-1.5">
            {tryResult.length === 0 ? (
              <span className="text-sm text-muted-foreground">No categories match.</span>
            ) : (
              tryResult.map((s) => {
                const c = catById.get(s.category_id);
                return (
                  <span key={s.category_id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {c?.icon} {c?.name ?? s.slug}
                    <span className="text-muted-foreground">via "{s.matched_keyword}"</span>
                  </span>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">All categories ({sorted.length})</h3>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setEditOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add category
        </Button>
      </div>
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
          : sorted.map((c, i) => (
              <div key={c.id} className="admin-panel p-3 flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: c.color ? `${c.color}26` : undefined }}
                >
                  {c.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {c.name} <span className="text-xs text-muted-foreground">/{c.slug}</span>
                  </p>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {upcoming?.[c.id] ?? 0} upcoming · {stats?.totals[c.id] ?? 0} total · {c.keywords?.length ?? 0} keywords
                  </p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, "up")}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === sorted.length - 1} onClick={() => move(i, "down")}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => {
                      setEditing(c);
                      setEditOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
      </div>

      <CategoryEditDialog open={editOpen} onOpenChange={setEditOpen} category={editing} nextSortOrder={nextSort} />
      <AutoCategorizeReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {stats?.totals[deleting?.id ?? ""] ?? 0} events are currently tagged with it. Deleting removes those tags but
              not the events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auto-categorize all upcoming events?</AlertDialogTitle>
            <AlertDialogDescription>
              Every upcoming, uncategorized event with a keyword match will be tagged right away. You can still edit them afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runAll();
              }}
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
