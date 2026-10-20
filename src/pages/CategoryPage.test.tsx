import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CategoryPage from "./CategoryPage";

const categories = [
  { id: "c1", name: "Music", slug: "music", icon: "🎵", color: null, sort_order: 1, description: "Live bands.", keywords: [] },
  { id: "c2", name: "Comedy", slug: "comedy", icon: "🎤", color: null, sort_order: 2, description: "Laughs.", keywords: [] },
];
let events: { id: string; slug: string; title: string; start_time: string }[] = [];

vi.mock("@/components/layout/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ data: categories, isLoading: false }) }));
vi.mock("@/hooks/useSettings", () => ({ useSettings: () => ({ data: undefined }), DEFAULT_FEED_DISPLAY: { mobileColumns: 1, desktopColumns: 2 } }));
vi.mock("@/hooks/useEvents", () => ({
  useInfiniteApprovedEvents: (opts: { categoryIds?: string[] }) => ({
    data: { pages: [{ data: opts.categoryIds ? events : [] }] },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("@/components/events/EventCard", () => ({ EventCard: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock("@/components/ui/header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

function renderAt(path: string) {
  class IO { observe() {} disconnect() {} unobserve() {} }
  vi.stubGlobal("IntersectionObserver", IO);
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/categories/:slug" element={<CategoryPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("CategoryPage", () => {
  it("lists the category's upcoming events", () => {
    events = [{ id: "e1", slug: "show-1", title: "Jazz Night", start_time: "2026-11-01T23:00:00Z" }];
    renderAt("/categories/music");
    expect(screen.getByRole("heading", { name: /Music/ })).toBeTruthy();
    expect(screen.getByText("Jazz Night")).toBeTruthy();
  });

  it("still resolves a category with no upcoming events and says so", () => {
    events = [];
    renderAt("/categories/comedy");
    expect(screen.getByText("No upcoming Comedy events yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse all events" }).getAttribute("href")).toBe("/");
  });

  it("shows the not-found page for an unknown slug", () => {
    renderAt("/categories/does-not-exist");
    expect(screen.getByText("404")).toBeTruthy();
  });
});
