// Supabase embeds a to-one relation as an object at runtime, but the query
// builder types it as an array when there are no generated DB types. Normalize.
export function one<T = Record<string, unknown>>(rel: unknown): T | undefined {
  if (Array.isArray(rel)) return rel[0] as T | undefined;
  return (rel as T) ?? undefined;
}
