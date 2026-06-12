/** The JSON-serializable payload produced by `dehydrate(store)` and consumed by
 *  `hydrate(store, payload)`.
 *
 *  - `atoms` — one `[name, value]` entry per registered plain atom holding an
 *    own value in the dehydrated store.
 *  - `families` — one `[familyName, args, value]` entry per atomFamily member
 *    holding an own value in the dehydrated store. `args` is the member's
 *    original `familyArgs` array (NOT the family's internal cache key):
 *    `family(...args)` re-derives the same cache key after a JSON round-trip,
 *    so the entry resolves to the same member on the hydrating side. It is a
 *    non-empty tuple, mirroring the `Args extends [any, ...any[]]` constraint
 *    on `atomFamily` — a member always has at least one arg.
 *
 *  Values and family args must themselves be JSON-serializable for the payload
 *  to survive `JSON.stringify`/`parse` — valdres does not transform them. */
export type DehydratedState = {
    atoms: [name: string, value: unknown][]
    families: [name: string, args: [unknown, ...unknown[]], value: unknown][]
}
