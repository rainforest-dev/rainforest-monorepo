/**
 * The filter parameters every collection understands, so a filtered view can be carried from
 * one collection to another (`/books?tag=frontend` → `/?tag=frontend`). Each collection may add
 * its own parameters; they pass through untouched.
 */
export const SHARED_PARAMS = ['q', 'tag', 'group', 'view'] as const;
export type SharedParam = (typeof SHARED_PARAMS)[number];

export type SharedParams = Record<SharedParam, string | null>;

export type SearchParamsLike =
  URLSearchParams | string | Record<string, string | string[] | undefined>;

function toSearchParams(input: SearchParamsLike): URLSearchParams {
  if (typeof input === 'string' || input instanceof URLSearchParams)
    return new URLSearchParams(input);
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) out.append(key, first);
  }
  return out;
}

export function parseSharedParams(input: SearchParamsLike): SharedParams {
  const sp = toSearchParams(input);
  const read = (key: SharedParam) => sp.get(key)?.trim() || null;
  return {
    q: read('q'),
    tag: read('tag'),
    group: read('group'),
    view: read('view'),
  };
}

/**
 * A same-origin href to `path` carrying only the shared parameters that are set. Pass it the
 * current page's parameters to hand a filter to another collection.
 */
export function sharedHref(
  path: string,
  params: Partial<SharedParams>,
): string {
  const sp = new URLSearchParams();
  for (const key of SHARED_PARAMS) {
    const value = params[key]?.trim();
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
