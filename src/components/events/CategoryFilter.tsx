import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCategoryUpcomingCounts, filterCategoriesWithUpcoming } from "@/hooks/useCategories";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  isLoading?: boolean;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  isLoading,
}: CategoryFilterProps) {
  const { data: counts } = useCategoryUpcomingCounts();
  categories = filterCategoriesWithUpcoming(categories, counts, [selectedCategory]);
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 py-2 px-4">
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            "category-pill flex-shrink-0",
            selectedCategory === null && "active"
          )}
        >
          All Events
        </button>
        {categories.map((category) => (
          <motion.button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              "category-pill flex-shrink-0",
              selectedCategory === category.id && "active"
            )}
            whileTap={{ scale: 0.95 }}
            style={
              selectedCategory === category.id && category.color
                ? {
                    backgroundColor: category.color,
                    boxShadow: `0 4px 12px -2px ${category.color}66`,
                  }
                : undefined
            }
          >
            {category.icon && <span>{category.icon}</span>}
            {category.name}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
