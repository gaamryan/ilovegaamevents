import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "@/hooks/useCategories";
import { addKeywords, slugifyCategory } from "@/lib/categoryHelpers";

const DESC_SOFT_LIMIT = 100;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: Category | null; // null = create
  nextSortOrder: number;
}

export function CategoryEditDialog({ open, onOpenChange, category, nextSortOrder }: Props) {
  const qc = useQueryClient();
  const isNew = !category;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#0891B2");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setSlugTouched(!!category);
    setIcon(category?.icon ?? "");
    setColor(category?.color ?? "#0891B2");
    setDescription(category?.description ?? "");
    setKeywords(category?.keywords ?? []);
    setKwInput("");
    setSortOrder(category?.sort_order ?? nextSortOrder);
  }, [open, category, nextSortOrder]);

  const onNameChange = (v: string) => {
    setName(v);
    if (isNew && !slugTouched) setSlug(slugifyCategory(v));
  };

  const commitKw = () => {
    if (!kwInput.trim()) return;
    setKeywords((k) => addKeywords(k, kwInput));
    setKwInput("");
  };

  const slugChanged = !isNew && slug !== category?.slug;
  const hexValid = /^#[0-9a-fA-F]{6}$/.test(color);

  const save = async () => {
    const finalSlug = slugifyCategory(slug || name);
    if (!name.trim() || !finalSlug) {
      toast.error("Name and slug are required");
      return;
    }
    const finalKeywords = kwInput.trim() ? addKeywords(keywords, kwInput) : keywords;
    setSaving(true);
    const payload = {
      name: name.trim(),
      slug: finalSlug,
      icon: icon.trim() || null,
      color: hexValid ? color : null,
      description: description.trim() || null,
      keywords: finalKeywords,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    };
    const { error } = isNew
      ? await supabase.from("categories").insert(payload)
      : await supabase.from("categories").update(payload).eq("id", category!.id);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That slug is already in use" : "Failed to save category");
      console.error(error);
      return;
    }
    toast.success(isNew ? "Category added" : "Category saved");
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["category-upcoming-counts"] });
    qc.invalidateQueries({ queryKey: ["admin-category-stats"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add category" : `Edit ${category?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={name} onChange={(e) => onNameChange(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">Icon</Label>
              <Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)} className="text-center text-lg" maxLength={8} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
            {slugChanged && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Changing the slug affects links that use it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-color">Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Pick color"
                  value={hexValid ? color : "#000000"}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="h-10 w-12 rounded border border-border bg-transparent cursor-pointer"
                />
                <Input id="cat-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#D946EF" />
              </div>
              {!hexValid && color && <p className="text-xs text-destructive">Use a hex value like #D946EF</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-sort">Sort order</Label>
              <Input id="cat-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="cat-desc">Description</Label>
              <span className={`text-xs ${description.length > DESC_SOFT_LIMIT ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/{DESC_SOFT_LIMIT}
              </span>
            </div>
            <Textarea id="cat-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-kw">Keywords</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-md min-h-10">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {k}
                  <button type="button" aria-label={`Remove ${k}`} onClick={() => setKeywords((ks) => ks.filter((x) => x !== k))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="cat-kw"
                value={kwInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.includes(",")) {
                    setKeywords((k) => addKeywords(k, v));
                    setKwInput("");
                  } else setKwInput(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitKw();
                  } else if (e.key === "Backspace" && !kwInput && keywords.length) {
                    setKeywords((k) => k.slice(0, -1));
                  }
                }}
                onBlur={commitKw}
                placeholder="Add keyword…"
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Matched against event title, venue name, and host name. Whole words only. Phrases are fine.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
