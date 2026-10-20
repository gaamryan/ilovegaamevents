import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SearchBar } from "./SearchBar";

vi.mock("@/hooks/useSearchSuggestions", () => ({
  useSearchSuggestions: () => ({
    isFetching: false,
    data: [
      { id: "e1", slug: "game-night-abc", label: "Game Night", type: "event", subtitle: "The Venue" },
      { id: "v1", label: "Decca Live", type: "venue", subtitle: "Jacksonville" },
    ],
  }),
}));

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function setup(props: Partial<React.ComponentProps<typeof SearchBar>> = {}) {
  const onCommit = vi.fn();
  const onSelectVenue = vi.fn();
  const utils = render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="*" element={<><SearchBar value="" onCommit={onCommit} onSelectVenue={onSelectVenue} {...props} /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onCommit, onSelectVenue, ...utils, input: screen.getByRole("combobox") as HTMLInputElement };
}

describe("SearchBar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is editable and shows typed text immediately, committing once after the debounce", () => {
    const { input, onCommit } = setup();
    expect(input.readOnly).toBe(false);
    expect(input.type).toBe("search");
    fireEvent.change(input, { target: { value: "smash" } });
    expect(input.value).toBe("smash");
    expect(onCommit).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("smash");
  });

  it("commits immediately on Enter and closes the suggestions", () => {
    const { input, onCommit } = setup();
    fireEvent.change(input, { target: { value: "game" } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("game");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens an event suggestion at its slug URL", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "game" } });
    fireEvent.click(screen.getByText("Game Night"));
    expect(screen.getByTestId("where").textContent).toBe("/events/game-night-abc");
  });

  it("applies a venue suggestion as a location filter and clears the text", () => {
    const { input, onSelectVenue, onCommit } = setup();
    fireEvent.change(input, { target: { value: "decca" } });
    fireEvent.click(screen.getByText("Decca Live"));
    expect(onSelectVenue).toHaveBeenCalledWith("Decca Live");
    expect(input.value).toBe("");
    act(() => { vi.advanceTimersByTime(500); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("navigates suggestions with the arrow keys and exposes combobox state", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "game" } });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)?.getAttribute("aria-selected")).toBe("true");
  });

  it("has a labelled clear button that commits an empty search", () => {
    const { input, onCommit } = setup({ value: "" });
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input.value).toBe("");
    expect(onCommit).toHaveBeenCalledTimes(0);
  });

  it("shows an externally changed value instead of stale text", () => {
    const onCommit = vi.fn();
    const ui = (value: string) => (
      <MemoryRouter><SearchBar value={value} onCommit={onCommit} onSelectVenue={vi.fn()} /></MemoryRouter>
    );
    const { rerender } = render(ui("jazz"));
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("jazz");
    rerender(ui(""));
    expect(input.value).toBe("");
  });
});
