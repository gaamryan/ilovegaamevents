import { useState } from "react";
import { format, startOfDay, endOfDay, endOfWeek, nextSaturday, nextSunday } from "date-fns";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar as CalendarIcon2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategoryUpcomingCounts, filterCategoriesWithUpcoming } from "@/hooks/useCategories";

export interface EventFilters {
  dateFrom?: Date;
  dateTo?: Date;
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
  location?: string;
  categoryIds?: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface FilterDrawerProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  activeFilterCount: number;
  categories: Category[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FilterDrawer({ 
  filters, 
  onFiltersChange, 
  activeFilterCount,
  categories,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: FilterDrawerProps) {
  const [localFilters, setLocalFilters] = useState<EventFilters>(filters);
  const [internalOpen, setInternalOpen] = useState(false);
  const { data: upcomingCounts } = useCategoryUpcomingCounts();
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    controlledOnOpenChange?.(v);
  };

  const getThisWeekDates = () => {
    const now = new Date();
    return { from: startOfDay(now), to: endOfDay(endOfWeek(now, { weekStartsOn: 0 })) };
  };

  const getThisWeekendDates = () => {
    const now = new Date();
    const day = now.getDay();
    let sat: Date, sun: Date;
    if (day === 6) { sat = startOfDay(now); sun = endOfDay(new Date(now.getTime() + 86400000)); }
    else if (day === 0) { sat = startOfDay(new Date(now.getTime() - 86400000)); sun = endOfDay(now); }
    else { sat = startOfDay(nextSaturday(now)); sun = endOfDay(nextSunday(now)); }
    return { from: sat, to: sun };
  };

  const isThisWeek = (from: Date, to: Date) => {
    const w = getThisWeekDates();
    return Math.abs(from.getTime() - w.from.getTime()) < 1000 && Math.abs(to.getTime() - w.to.getTime()) < 1000;
  };

  const isThisWeekend = (from: Date, to: Date) => {
    const w = getThisWeekendDates();
    return Math.abs(from.getTime() - w.from.getTime()) < 1000 && Math.abs(to.getTime() - w.to.getTime()) < 1000;
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: EventFilters = {};
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const updateFilter = <K extends keyof EventFilters>(key: K, value: EventFilters[K]) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (categoryId: string) => {
    const currentIds = localFilters.categoryIds || [];
    const newIds = currentIds.includes(categoryId)
      ? currentIds.filter(id => id !== categoryId)
      : [...currentIds, categoryId];
    updateFilter("categoryIds", newIds.length > 0 ? newIds : undefined);
  };

  // Sync local filters when drawer opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalFilters(filters);
    }
    setOpen(isOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
          className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center justify-between">
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                  Clear all
                </Button>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="h-[60vh] px-4">
            <div className="space-y-6 pb-4">
              {/* Quick Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Quick Filters</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={localFilters.dateFrom && localFilters.dateTo && !localFilters.isFree && isThisWeek(localFilters.dateFrom, localFilters.dateTo) ? "default" : "outline"}
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={() => {
                      const { from, to } = getThisWeekDates();
                      if (localFilters.dateFrom && localFilters.dateTo && isThisWeek(localFilters.dateFrom, localFilters.dateTo)) {
                        setLocalFilters(prev => { const n = { ...prev }; delete n.dateFrom; delete n.dateTo; return n; });
                      } else {
                        setLocalFilters(prev => ({ ...prev, dateFrom: from, dateTo: to, isFree: undefined }));
                      }
                    }}
                  >
                    <CalendarIcon2 className="h-3.5 w-3.5" />
                    This Week
                  </Button>
                  <Button
                    variant={localFilters.dateFrom && localFilters.dateTo && !localFilters.isFree && isThisWeekend(localFilters.dateFrom, localFilters.dateTo) ? "default" : "outline"}
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={() => {
                      const { from, to } = getThisWeekendDates();
                      if (localFilters.dateFrom && localFilters.dateTo && isThisWeekend(localFilters.dateFrom, localFilters.dateTo)) {
                        setLocalFilters(prev => { const n = { ...prev }; delete n.dateFrom; delete n.dateTo; return n; });
                      } else {
                        setLocalFilters(prev => ({ ...prev, dateFrom: from, dateTo: to, isFree: undefined }));
                      }
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    This Weekend
                  </Button>
                  <Button
                    variant={localFilters.isFree ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      if (localFilters.isFree) {
                        setLocalFilters(prev => { const n = { ...prev }; delete n.isFree; return n; });
                      } else {
                        setLocalFilters(prev => ({ ...prev, isFree: true, dateFrom: undefined, dateTo: undefined }));
                      }
                    }}
                  >
                    🎉 Free
                  </Button>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Categories</Label>
                <div className="grid grid-cols-2 gap-2">
                  {filterCategoriesWithUpcoming(categories, upcomingCounts, [
                    ...(localFilters.categoryIds || []),
                    ...(filters.categoryIds || []),
                  ]).map((category) => (
                    <label
                      key={category.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        localFilters.categoryIds?.includes(category.id)
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border hover:bg-secondary/50"
                      )}
                    >
                      <Checkbox
                        checked={localFilters.categoryIds?.includes(category.id) || false}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <span className="text-sm font-medium truncate">
                        {category.icon && <span className="mr-1">{category.icon}</span>}
                        {category.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Date Range</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !localFilters.dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {localFilters.dateFrom ? format(localFilters.dateFrom, "MMM d") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={localFilters.dateFrom}
                          onSelect={(date) => updateFilter("dateFrom", date)}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !localFilters.dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {localFilters.dateTo ? format(localFilters.dateTo, "MMM d") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={localFilters.dateTo}
                          onSelect={(date) => updateFilter("dateTo", date)}
                          disabled={(date) => localFilters.dateFrom ? date < localFilters.dateFrom : false}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Price</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="free-only" className="text-sm text-muted-foreground">Free only</Label>
                    <Switch
                      id="free-only"
                      checked={localFilters.isFree || false}
                      onCheckedChange={(checked) => updateFilter("isFree", checked)}
                    />
                  </div>
                </div>
                
                {!localFilters.isFree && (
                  <div className="space-y-4">
                    <Slider
                      value={[localFilters.priceMin || 0, localFilters.priceMax || 200]}
                      onValueChange={([min, max]) => {
                        updateFilter("priceMin", min);
                        updateFilter("priceMax", max);
                      }}
                      max={200}
                      step={5}
                      className="py-4"
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>${localFilters.priceMin || 0}</span>
                      <span>${localFilters.priceMax || 200}+</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Location</Label>
                <Input
                  placeholder="City or venue name..."
                  value={localFilters.location || ""}
                  onChange={(e) => updateFilter("location", e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>

          <DrawerFooter className="pt-2">
            <Button onClick={handleApply} className="w-full">
              Show results
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
