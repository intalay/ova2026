export type RosterRow = { key: string; name: string; jersey: string | null };

export function parseRosterCsv(text: string): { rows: RosterRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (!lines.length) return { rows: [], errors: ["Roster is empty."] };
  const header = (lines[0] ?? "").toLowerCase().split(",").map((h) => h.trim());
  const idx = { id: header.indexOf("player_id"), name: header.indexOf("name"), jersey: header.indexOf("jersey") };
  if (idx.id < 0 || idx.name < 0) return { rows: [], errors: ["Header must include player_id and name."] };
  const seen = new Set<string>();
  const rows: RosterRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = line.split(",").map((x) => x.trim());
    const key = (c[idx.id] ?? "").replace(/[^A-Za-z0-9_-]/g, "");
    const name = c[idx.name] ?? "";
    if (!key || !name) { errors.push(`Row ${i + 2}: player_id and name are required.`); return; }
    if (seen.has(key)) { errors.push(`Row ${i + 2}: duplicate player_id ${key}.`); return; }
    seen.add(key);
    rows.push({ key, name, jersey: (idx.jersey >= 0 ? c[idx.jersey] : undefined) || null });
  });
  return { rows, errors };
}
