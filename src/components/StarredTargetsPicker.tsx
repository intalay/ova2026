import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DisplayTeam, TeamDisplayContext } from "@/lib/team-display";
import {
  buildStarredTargets,
  starredTargetsPage,
  type StarredDivision,
  type StarredTarget,
  type StarredTargetKind,
} from "@/lib/starred-targets";

export type StarredTargetsPickerProps = {
  dataMode?: "real" | "synthetic";
  disabled?: boolean;
  teams: readonly DisplayTeam[];
  divisions: readonly StarredDivision[];
  context: TeamDisplayContext;
  followed: ReadonlySet<string>;
  onToggle: (kind: StarredTargetKind, id: string) => void | Promise<void>;
};

// Controlled stars: persistence stays with the existing Schedule callback.
export function StarredTargetsPicker({
  dataMode = "real",
  disabled = false,
  teams,
  divisions,
  context,
  followed,
  onToggle,
}: StarredTargetsPickerProps) {
  const id = useId();
  const listId = `${id}-targets`;
  const statusId = `${id}-status`;
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const focusAfterPage = useRef(false);
  const toggledFocus = useRef<string | null>(null);
  const [kind, setKind] = useState<StarredTargetKind>("team");
  const [query, setQuery] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const targets = useMemo(
    () => buildStarredTargets(teams, divisions, context, dataMode),
    [teams, divisions, context, dataMode],
  );
  const result = starredTargetsPage(targets, { kind, query, starredOnly, followed, page });
  const rowKeys = result.rows.map((target) => `${target.kind}:${target.id}`).join("|");
  useEffect(() => {
    if (page !== result.pageIndex) setPage(result.pageIndex);
  }, [page, result.pageIndex]);
  useEffect(() => {
    if (busy) return;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("[data-star-target]");
    const focusLost = !document.activeElement || document.activeElement === document.body;
    if (focusAfterPage.current || (toggledFocus.current && focusLost)) {
      const previous = Array.from(buttons ?? []).find(
        (button) => button.dataset["starTarget"] === toggledFocus.current,
      );
      if (!focusAfterPage.current && previous) previous.focus();
      else if (buttons?.[0]) buttons[0].focus();
      else search.current?.focus();
      focusAfterPage.current = false;
    }
    toggledFocus.current = null;
  }, [rowKeys, busy]);
  const changePage = (next: number) => {
    setPage(next);
    focusAfterPage.current = true;
  };
  function resetPage() {
    setPage(0);
    setFailed(false);
  }
  async function toggle(target: StarredTarget, button: HTMLButtonElement) {
    if (busy || disabled) return;
    const key = `${target.kind}:${target.id}`;
    if (document.activeElement === button) toggledFocus.current = key;
    setBusy(key);
    setFailed(false);
    try {
      await onToggle(target.kind, target.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }
  function move(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.nativeEvent.isComposing) return;
    const buttons = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("[data-star-target]") ?? [],
    );
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || busy) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      buttons[
        (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
      ]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
    } else if (event.key === "PageDown" && result.pageIndex + 1 < result.pageCount) {
      event.preventDefault();
      changePage(result.pageIndex + 1);
    } else if (event.key === "PageUp" && result.pageIndex > 0) {
      event.preventDefault();
      changePage(result.pageIndex - 1);
    }
  }
  const plural = kind === "team" ? "teams" : "divisions";
  const countLabel = result.total === 1 ? (kind === "team" ? "team" : "division") : plural;
  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div role="group" aria-label="Star target type" className="flex flex-wrap items-center gap-2">
        {(["team", "division"] as const).map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={type === kind ? "secondary" : "ghost"}
            aria-pressed={type === kind}
            aria-controls={listId}
            onClick={() => {
              setKind(type);
              resetPage();
            }}
          >
            {type === "team" ? "Teams" : "Divisions"}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={starredOnly}
          aria-controls={listId}
          onClick={() => {
            setStarredOnly(!starredOnly);
            resetPage();
          }}
        >
          Starred only
        </Button>
      </div>
      <label htmlFor={`${id}-search`} className="block text-sm font-semibold">
        Search {plural}
      </label>
      <div className="relative min-w-0">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground"
        />
        <input
          id={`${id}-search`}
          ref={search}
          type="search"
          value={query}
          aria-describedby={statusId}
          aria-controls={listId}
          autoComplete="off"
          placeholder={kind === "team" ? "Team name, event or division" : "Division or event"}
          className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-input bg-card pl-10 pr-12 text-base text-foreground placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => {
            setQuery(event.target.value);
            resetPage();
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear starred search"
            className="absolute right-0 top-0 flex size-12 items-center justify-center rounded-md text-muted-foreground"
            onClick={() => {
              setQuery("");
              resetPage();
              search.current?.focus();
            }}
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <p id={statusId} role="status" className="text-sm text-muted-foreground">
        {result.total
          ? `${result.total} ${countLabel} · Showing ${result.start}–${result.end}`
          : `0 ${plural}`}
      </p>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Could not update this star. Try again.
        </p>
      )}
      <ul
        id={listId}
        ref={list}
        aria-label={`Star ${plural}`}
        aria-busy={busy !== null}
        className="min-w-0 space-y-1"
        onKeyDown={move}
      >
        {result.rows.map((target) => {
          const key = `${target.kind}:${target.id}`;
          const starred = followed.has(key);
          return (
            <li key={key} className="min-w-0">
              <button
                type="button"
                data-star-target={key}
                aria-pressed={starred}
                disabled={busy !== null || disabled}
                className="flex min-h-16 w-full min-w-0 items-start justify-between gap-3 rounded-lg bg-card px-3 py-3 text-left text-foreground hover:bg-secondary disabled:opacity-60"
                onClick={(event) => {
                  void toggle(target, event.currentTarget);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold [overflow-wrap:anywhere]">
                    {target.primary}
                  </span>
                  <span className="mt-1 block break-words text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                    {target.secondary}
                  </span>
                </span>
                <span className="sr-only">{starred ? "Starred" : "Not starred"}</span>
                <Star
                  aria-hidden
                  className={`mt-0.5 size-5 shrink-0 ${starred ? "fill-starred text-starred" : "text-muted-foreground"}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      {!result.total && (
        <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          {starredOnly ? `No starred ${plural} in this view.` : `No ${plural} found.`}{" "}
          {query
            ? "Try another search or clear the search."
            : starredOnly
              ? "Turn off Starred only to add a star."
              : "No public records are available."}
        </p>
      )}
      {result.pageCount > 0 && (
        <nav
          aria-label="Starred items pages"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={result.pageIndex === 0 || busy !== null}
            onClick={() => changePage(result.pageIndex - 1)}
          >
            <ArrowLeft aria-hidden />
            Previous
          </Button>
          <span className="text-sm font-semibold">
            Page {result.pageIndex + 1} of {result.pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={result.pageIndex + 1 >= result.pageCount || busy !== null}
            onClick={() => changePage(result.pageIndex + 1)}
          >
            Next
            <ArrowRight aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  );
}
