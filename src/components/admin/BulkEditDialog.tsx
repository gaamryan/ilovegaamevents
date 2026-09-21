import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/hooks/useCategories";
import { useBulkUpdateEvents } from "@/hooks/useEvents";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BulkEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedEventIds: string[];
    onSuccess: () => void;
}

export function BulkEditDialog({ open, onOpenChange, selectedEventIds, onSuccess }: BulkEditDialogProps) {
    const { data: categories } = useCategories();
    const bulkUpdate = useBulkUpdateEvents();

    const [categoryId, setCategoryId] = useState<string>("no-change");
    const [priceType, setPriceType] = useState<"no-change" | "free" | "paid">("no-change");
    const [priceMin, setPriceMin] = useState<string>("");
    const [priceMax, setPriceMax] = useState<string>("");

    const handleSave = async () => {
        const updates: {
            category_id?: string;
            is_free?: boolean;
            price_min?: number;
            price_max?: number;
        } = {};
        let hasUpdates = false;

        if (categoryId !== "no-change") {
            updates.category_id = categoryId;
            hasUpdates = true;
        }

        if (priceType === "free") {
            updates.is_free = true;
            updates.price_min = 0;
            updates.price_max = 0;
            hasUpdates = true;
        } else if (priceType === "paid") {
            updates.is_free = false;
            if (priceMin) updates.price_min = parseFloat(priceMin);
            if (priceMax) updates.price_max = parseFloat(priceMax);
            hasUpdates = true;
        }

        if (!hasUpdates) {
            onOpenChange(false);
            return;
        }

        try {
            await bulkUpdate.mutateAsync({
                eventIds: selectedEventIds,
                updates,
            });
            toast.success(`Updated ${selectedEventIds.length} events`);
            onSuccess();
            onOpenChange(false);
            // Reset form
            setCategoryId("no-change");
            setPriceType("no-change");
            setPriceMin("");
            setPriceMax("");
        } catch (error) {
            toast.error("Failed to update events");
            console.error(error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit {selectedEventIds.length} Events</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no-change">Don't Change</SelectItem>
                                {categories?.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                        <Label>Price</Label>
                        <Select value={priceType} onValueChange={(val: "no-change" | "free" | "paid") => setPriceType(val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select price change" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no-change">Don't Change</SelectItem>
                                <SelectItem value="free">Mark as Free</SelectItem>
                                <SelectItem value="paid">Set Price</SelectItem>
                            </SelectContent>
                        </Select>

                        {priceType === "paid" && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <Input
                                    type="number"
                                    placeholder="Min Price"
                                    value={priceMin}
                                    onChange={(e) => setPriceMin(e.target.value)}
                                />
                                <Input
                                    type="number"
                                    placeholder="Max Price"
                                    value={priceMax}
                                    onChange={(e) => setPriceMax(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={bulkUpdate.isPending}>
                        {bulkUpdate.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Update Events
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
