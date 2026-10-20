import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

export type SortOption = "date_asc" | "date_desc" | "price_low" | "price_high";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "date_asc", label: "Date (Soonest)" },
  { value: "date_desc", label: "Date (Latest)" },
  { value: "price_low", label: "Price (Low to High)" },
  { value: "price_high", label: "Price (High to Low)" },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[120px] sm:w-[160px] h-11 bg-background text-foreground border-input">
        <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent className="bg-background border z-50">
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
