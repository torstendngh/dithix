const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Fills gaps in persisted data with defaults, recursively for plain objects.
 * Values whose type differs from the default are dropped, so stale or corrupt
 * storage can't break the app. `nullable` lists dotted paths where a stored
 * `null` is a legitimate value (e.g. "palette.presetId") and must be kept.
 */
export function mergeDefaults<T>(
  defaults: T,
  persisted: unknown,
  nullable: ReadonlySet<string> = new Set(),
  path = "",
): T {
  if (persisted === null && nullable.has(path)) return null as T;
  if (persisted === undefined || persisted === null) return defaults;
  if (isPlainObject(defaults)) {
    if (!isPlainObject(persisted)) return defaults;
    const out: Record<string, unknown> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      out[key] = mergeDefaults(
        (defaults as Record<string, unknown>)[key],
        persisted[key],
        nullable,
        path ? `${path}.${key}` : key,
      );
    }
    return out as T;
  }
  if (Array.isArray(defaults)) return (Array.isArray(persisted) ? persisted : defaults) as T;
  if (defaults === null) return persisted as T;
  return (typeof persisted === typeof defaults ? persisted : defaults) as T;
}
