import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  resolveParentContext,
  validateBrowseSearch,
  type BrowseSearch,
} from "@/lib/parent-context";
import type { AppRole } from "@/lib/modules";
import type { Household } from "@/lib/queries";
export type ParentIdentity = {
  user: { id: string } | null;
  role: AppRole;
  ready?: boolean;
  household: { data: Household | undefined; isPending?: boolean; isError?: boolean };
};

// URL and session values are preferences only; recheck current approved associations every render.
export function useParentContext(identity: ParentIdentity, teams: { id: string }[] = []) {
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const { user, role, household } = identity;
  const key = user ? `ova-browse:${user.id}:${role}` : "";
  const [saved, setSaved] = useState<{ key: string; search: BrowseSearch } | null>(null);
  useEffect(() => {
    let search: BrowseSearch = {};
    if (key)
      try {
        search = validateBrowseSearch(JSON.parse(sessionStorage.getItem(key) ?? "{}"));
      } catch {
        /* unavailable storage is optional */
      }
    setSaved({ key, search });
  }, [key]);
  const routeSearch = validateBrowseSearch(raw);
  const explicit = routeSearch.player !== undefined || routeSearch.team !== undefined;
  const pending =
    identity.ready === false || (!!user && (household.isPending || saved?.key !== key));
  const context = resolveParentContext(
    pending || household.isError ? undefined : user?.id,
    role,
    household.data,
    explicit ? routeSearch : saved?.key === key ? saved.search : {},
    teams,
  );
  const { player, team } = context.search;
  useEffect(() => {
    if (!key || pending || household.isError || context.invalid || (!player && !team)) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ player, team }));
    } catch {
      /* optional */
    }
  }, [key, pending, household.isError, context.invalid, player, team]);
  function select(search: BrowseSearch) {
    const checked = resolveParentContext(user?.id, role, household.data, search, teams);
    if (pending || household.isError || checked.invalid) return;
    setSaved({ key, search: checked.search });
    void navigate({
      to: ".",
      search: (previous) => ({
        ...previous,
        player: checked.search.player,
        team: checked.search.team,
      }),
    });
  }
  return { ...context, pending, select };
}
