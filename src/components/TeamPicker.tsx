import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search, SlidersHorizontal, X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clubTeamOptions,
  eventPairOptions,
  teamPresentation,
  type DisplayTeam,
  type TeamDisplayContext,
} from "@/lib/team-display";

export type TeamPickerProps = {
  teams: readonly DisplayTeam[];
  context: TeamDisplayContext;
  value: string;
  onChange: (teamId: string) => void;
  eventId?: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};
const PAGE_SIZE = 6;
const inputClass =
  "min-h-12 w-full min-w-0 max-w-full rounded-md border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground";
const rowClass =
  "flex min-h-16 w-full min-w-0 items-start justify-between gap-3 rounded-md px-3 py-3 text-left text-foreground hover:bg-secondary";

export function TeamPicker({
  teams,
  context,
  value,
  onChange,
  eventId = "",
  loading = false,
  error = false,
  onRetry,
}: TeamPickerProps) {
  const id = useId();
  const listId = `${id}-teams`;
  const helpId = `${id}-help`;
  const keysId = `${id}-keys`;
  const filtersId = `${id}-filters`;
  const pairsId = `${id}-pairs`;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(-1);
  const [pairsOpen, setPairsOpen] = useState(false);
  const [pairPage, setPairPage] = useState(0);
  const publicTeams = useMemo(() => teams.filter((t) => t.data_mode === "real"), [teams]);
  const catalog = useMemo(
    () =>
      clubTeamOptions(publicTeams).map((team) => ({
        team,
        label: teamPresentation(team, context),
        eventIds: new Set(
          context.teamEvents.filter((p) => p.teamId === team.id).map((p) => p.eventId),
        ),
      })),
    [publicTeams, context],
  );
  const hasIntent = !!query.trim() || !!eventFilter || !!divisionFilter;
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = catalog.filter(
    ({ team, label, eventIds }) =>
      (!eventFilter || eventIds.has(eventFilter)) &&
      (!divisionFilter || team.division_id === divisionFilter) &&
      words.every((word) => label.full.toLocaleLowerCase().includes(word)),
  );
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(matches.length / PAGE_SIZE) - 1));
  const visible = matches.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const expanded = open && hasIntent && !loading && !error;
  const selected = publicTeams.find((team) => team.id === value);
  const selectedLabel = selected ? teamPresentation(selected, context) : undefined;
  const pairEventId = eventFilter || eventId;
  const pairs = useMemo(
    () =>
      eventPairOptions(publicTeams, pairEventId, context).filter(
        (team) => !divisionFilter || team.division_id === divisionFilter,
      ),
    [publicTeams, pairEventId, context, divisionFilter],
  );
  const pairPageIndex = Math.min(pairPage, Math.max(0, Math.ceil(pairs.length / PAGE_SIZE) - 1));
  const visiblePairs = pairs.slice(pairPageIndex * PAGE_SIZE, (pairPageIndex + 1) * PAGE_SIZE);
  const divisionIds = new Set(
    catalog
      .filter((item) => !eventFilter || item.eventIds.has(eventFilter))
      .map((item) => item.team.division_id),
  );
  const publicIds = new Set(publicTeams.map((team) => team.id));
  const eventIds = new Set(
    context.teamEvents
      .filter((participation) => publicIds.has(participation.teamId))
      .map((participation) => participation.eventId),
  );
  useEffect(() => {
    setPairsOpen(false);
    setPairPage(0);
  }, [pairEventId]);
  useEffect(() => {
    if (expanded && active >= 0)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, expanded, listId]);

  function resetSearch(nextQuery = query) {
    setQuery(nextQuery);
    setPage(0);
    setActive(-1);
    setOpen(true);
  }
  function choose(teamId: string) {
    onChange(teamId);
    setQuery("");
    setActive(-1);
    setPairsOpen(false);
    input.current?.focus();
    setOpen(false);
  }
  function clearFilters() {
    setEventFilter("");
    setDivisionFilter("");
    resetSearch();
  }
  const activeOption =
    expanded && active >= 0 && visible[active] ? `${listId}-${active}` : undefined;

  return (
    <div
      className="team-picker min-w-0 max-w-full space-y-3"
      role="group"
      aria-label="Browse team"
      data-team-id={value}
      aria-busy={loading}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted-foreground">Browse team</p>
          <p className="mt-1 break-words text-lg font-semibold [overflow-wrap:anywhere]">
            {selectedLabel?.primary ??
              (value
                ? loading
                  ? "Loading selected team…"
                  : "Selected team unavailable"
                : "All teams")}
          </p>
          <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {selectedLabel?.secondary ?? "Public historical results"}
          </p>
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setEventFilter("");
              setDivisionFilter("");
              choose("");
            }}
          >
            All teams
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor={`${id}-search`}>
          Search teams
        </label>
        <div className="relative min-w-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground"
          />
          <input
            id={`${id}-search`}
            ref={input}
            type="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-activedescendant={activeOption}
            aria-describedby={`${helpId} ${keysId}`}
            disabled={loading || error}
            placeholder="Team name, event or division"
            value={query}
            className={`${inputClass} pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none`}
            onFocus={() => setOpen(true)}
            onChange={(event) => resetSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Tab") setOpen(false);
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                setActive(-1);
              }
              if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                hasIntent &&
                visible.length
              ) {
                event.preventDefault();
                setOpen(true);
                setActive((current) =>
                  !expanded || current < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : visible.length - 1
                    : (current + (event.key === "ArrowDown" ? 1 : -1) + visible.length) %
                      visible.length,
                );
              }
              if (event.key === "Enter" && expanded) {
                event.preventDefault();
                if (activeOption && visible[active]) choose(visible[active].team.id);
              }
            }}
          />
          {!!query && (
            <button
              type="button"
              aria-label="Clear team search"
              className="absolute right-0 top-0 flex size-12 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => {
                resetSearch("");
                input.current?.focus();
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
      <p id={keysId} className="sr-only">
        Use Up and Down arrows to review teams, Enter to select, and Escape to close.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={filtersOpen}
          aria-controls={filtersOpen ? filtersId : undefined}
          disabled={loading || error}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal aria-hidden />
          Search filters
          {(!!eventFilter || !!divisionFilter) &&
            ` (${Number(!!eventFilter) + Number(!!divisionFilter)})`}
        </Button>
        {(eventFilter || divisionFilter) && (
          <Button type="button" variant="link" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      {filtersOpen && (
        <div
          id={filtersId}
          className="grid min-w-0 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2"
        >
          <label className="min-w-0 space-y-2 text-sm font-semibold">
            <span className="block">Event</span>
            <select
              className={inputClass}
              value={eventFilter}
              onChange={(event) => {
                setEventFilter(event.target.value);
                setDivisionFilter("");
                resetSearch();
              }}
            >
              <option value="">Any event</option>
              {context.events
                .filter((event) => eventIds.has(event.id))
                .map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="min-w-0 space-y-2 text-sm font-semibold">
            <span className="block">Division</span>
            <select
              className={inputClass}
              value={divisionFilter}
              onChange={(event) => {
                setDivisionFilter(event.target.value);
                resetSearch();
              }}
            >
              <option value="">Any division</option>
              {context.divisions
                .filter((division) => divisionIds.has(division.id))
                .map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <p id={helpId} role={error ? "alert" : "status"} className="text-sm text-muted-foreground">
        {loading
          ? "Loading teams…"
          : error
            ? "Teams could not be loaded. Please try again."
            : !hasIntent
              ? "Start with a team name, or narrow by event or division."
              : !expanded
                ? "Search closed. Focus the search field to continue."
                : matches.length
                  ? `${matches.length} ${matches.length === 1 ? "result" : "results"} · Showing ${pageIndex * PAGE_SIZE + 1}–${pageIndex * PAGE_SIZE + visible.length}`
                  : "No teams found. Try another name or clear the filters."}
      </p>
      {error && onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
      {expanded && (
        <div
          id={listId}
          role="listbox"
          aria-label="Matching teams"
          className="min-w-0 max-w-full space-y-1"
        >
          {visible.map(({ team, label }, index) => (
            <button
              key={team.id}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={team.id === value}
              className={`${rowClass} ${active === index ? "bg-secondary ring-1 ring-inset ring-primary/30" : ""}`}
              onPointerDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(team.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold leading-snug [overflow-wrap:anywhere]">
                  {label.primary}
                </span>
                <span className="mt-1 block break-words text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                  {label.secondary}
                </span>
              </span>
              {team.id === value && <Check aria-hidden className="mt-0.5 size-5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
      {expanded && matches.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => {
              setPage(pageIndex - 1);
              setActive(-1);
            }}
          >
            <ArrowLeft aria-hidden />
            Previous teams
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * PAGE_SIZE >= matches.length}
            onClick={() => {
              setPage(pageIndex + 1);
              setActive(-1);
            }}
          >
            Show more teams
            <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
      {!loading && !error && pairs.length > 0 && (
        <div className="min-w-0 border-t pt-3">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto max-w-full px-0 text-left"
            aria-expanded={pairsOpen}
            aria-controls={pairsOpen ? pairsId : undefined}
            onClick={() => setPairsOpen(!pairsOpen)}
          >
            Anonymous pairs in this event ({pairs.length})
          </Button>
          {pairsOpen && (
            <div
              id={pairsId}
              role="group"
              aria-label="Anonymous pairs in this event"
              className="mt-2 min-w-0 space-y-1"
            >
              {visiblePairs.map((team) => {
                const label = teamPresentation(team, context);
                return (
                  <button
                    key={team.id}
                    type="button"
                    aria-pressed={team.id === value}
                    className={rowClass}
                    onClick={() => choose(team.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{label.primary}</span>
                      <span className="mt-1 block break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {label.secondary}
                      </span>
                    </span>
                    {team.id === value && <Check aria-hidden className="size-5 shrink-0" />}
                  </button>
                );
              })}
              {pairs.length > PAGE_SIZE && (
                <div className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pairPageIndex === 0}
                    onClick={() => setPairPage(pairPageIndex - 1)}
                  >
                    Previous pairs
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={(pairPageIndex + 1) * PAGE_SIZE >= pairs.length}
                    onClick={() => setPairPage(pairPageIndex + 1)}
                  >
                    Show more pairs
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
