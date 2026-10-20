import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSearchSuggestions, type SearchSuggestion } from "@/hooks/useSearchSuggestions";

const DEBOUNCE_MS = 300;

interface SearchBarProps {
  /** The committed search term (from the URL). */
  value: string;
  /** Called ~300ms after typing stops, or immediately on Enter / clear / "Search for". */
  onCommit: (query: string) => void;
  onSelectVenue: (venueName: string) => void;
  compact?: boolean;
  /** Rendered at the right edge of the field (the filter button). */
  children?: ReactNode;
}

type Option =
  | { kind: "event"; suggestion: SearchSuggestion }
  | { kind: "venue"; suggestion: SearchSuggestion }
  | { kind: "search" };

export function SearchBar({ value, onCommit, onSelectVenue, compact, children }: SearchBarProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>();
  const lastEmitted = useRef(value);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const listId = useId();
  const [draft, setDraft] = useState(value);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { data: suggestions, isFetching } = useSearchSuggestions(suggestQuery, 0);

  const emit = useCallback((raw: string) => {
    const term = raw.trim();
    if (term !== lastEmitted.current) {
      lastEmitted.current = term;
      onCommitRef.current(term);
    }
  }, []);

  // The term changed from outside (Clear all, Back/Forward): drop any pending
  // debounce and show the new value instead of overwriting it with stale text.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      window.clearTimeout(timer.current);
      lastEmitted.current = value;
      setDraft(value);
      setSuggestQuery("");
    }
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleChange = (next: string) => {
    setDraft(next);
    setOpen(true);
    setActiveIndex(-1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSuggestQuery(next.trim());
      emit(next);
    }, DEBOUNCE_MS);
  };

  const commitNow = (next: string) => {
    window.clearTimeout(timer.current);
    setSuggestQuery(next.trim());
    emit(next);
  };

  const events = (suggestions ?? []).filter((s) => s.type === "event");
  const venues = (suggestions ?? []).filter((s) => s.type === "venue");
  const showList = open && draft.trim().length >= 2;
  const options: Option[] = showList
    ? [
        ...events.map((suggestion): Option => ({ kind: "event", suggestion })),
        ...venues.map((suggestion): Option => ({ kind: "venue", suggestion })),
        { kind: "search" },
      ]
    : [];

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const choose = (option: Option) => {
    close();
    if (option.kind === "event") {
      inputRef.current?.blur();
      navigate(`/events/${option.suggestion.slug || option.suggestion.id}`);
    } else if (option.kind === "venue") {
      inputRef.current?.blur();
      window.clearTimeout(timer.current);
      lastEmitted.current = "";
      setDraft("");
      setSuggestQuery("");
      onSelectVenue(option.suggestion.label);
    } else {
      commitNow(draft);
      inputRef.current?.blur();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) choose(options[activeIndex]);
      else choose({ kind: "search" });
    } else if (e.key === "Escape") {
      close();
    }
  };

  const clear = () => {
    setDraft("");
    commitNow("");
    close();
    inputRef.current?.focus();
  };

  const optionId = (i: number) => `${listId}-option-${i}`;
  let optionIndex = -1;

  const renderRow = (option: Option, key: string, icon: ReactNode, label: ReactNode, subtitle?: string) => {
    optionIndex += 1;
    const index = optionIndex;
    return (
      <li
        key={key}
        id={optionId(index)}
        role="option"
        aria-selected={index === activeIndex}
        className={cn(
          "flex cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition-colors",
          index === activeIndex ? "bg-accent" : "hover:bg-accent",
        )}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(option)}
      >
        {icon}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{label}</div>
          {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </li>
    );
  };

  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Search events"
        aria-label="Search events or venues"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className={cn(
          "pl-10 transition-all duration-200 [&::-webkit-search-cancel-button]:appearance-none",
          draft ? "pr-20" : "pr-12",
          compact ? "h-9" : "h-11",
        )}
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className="absolute right-11 top-1/2 h-8 w-8 -translate-y-1/2 focus-visible:ring-2 focus-visible:ring-ring"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{children}</div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 top-full z-50 mt-1 max-h-[60vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {events.length > 0 && (
            <li role="presentation" className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Events
            </li>
          )}
          {events.map((s) =>
            renderRow({ kind: "event", suggestion: s }, `e-${s.id}`, <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />, s.label, s.subtitle),
          )}
          {venues.length > 0 && (
            <li role="presentation" className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Venues
            </li>
          )}
          {venues.map((s) =>
            renderRow({ kind: "venue", suggestion: s }, `v-${s.id}`, <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />, s.label, s.subtitle),
          )}
          {renderRow(
            { kind: "search" },
            "search",
            isFetching ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" /> : <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />,
            <>Search for “{draft.trim()}”</>,
          )}
        </ul>
      )}
    </div>
  );
}
