import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/header";
import { useCategories } from "@/hooks/useCategories";
import { Bell, BellOff } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

const Categories = () => {
  const { data: categories, isLoading } = useCategories();
  const navigate = useNavigate();
  const [followedCategories, setFollowedCategories] = useState<Set<string>>(new Set());

  const toggleFollow = (categoryId: string) => {
    setFollowedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <AppLayout>
      <Helmet>
        <title>Categories | {SITE_NAME}</title>
        <link rel="canonical" href={`${SITE_URL}/categories`} />
      </Helmet>
      <PageHeader title="Categories" subtitle="Browse by interest" />

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categories?.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative rounded-2xl overflow-hidden touch-feedback"
                style={{ backgroundColor: `${category.color}20` }}
                onClick={() => navigate(`/?category=${category.id}`)}
              >
                <div className="p-4 h-32 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{category.icon}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollow(category.id);
                      }}
                      className="w-8 h-8 rounded-full bg-card/80 flex items-center justify-center"
                    >
                      {followedCategories.has(category.id) ? (
                        <Bell className="h-4 w-4 text-primary" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: category.color || undefined }}
                    >
                      {category.name}
                    </h3>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Categories;
