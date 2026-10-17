grant insert, update on public.players to authenticated;
create policy "staff write players" on public.players for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "staff update players" on public.players for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));