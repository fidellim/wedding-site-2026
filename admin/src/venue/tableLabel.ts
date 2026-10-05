/** Display-only prefix; stored table names stay unchanged. */
export function tableLabel(name: string) {
  return /^table\b/i.test(name.trim()) ? name.trim() : `Table ${name.trim()}`;
}

/** Short label painted directly on a table. */
export function tableTopLabel(name: string) {
  return name.trim().replace(/^table\s+/i, "");
}
