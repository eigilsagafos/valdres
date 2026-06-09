// `seen` is the cycle guard, allocated lazily: a flat value (e.g. `{ title,
// body }`) has no nested objects to recurse into, so it never pays for a
// WeakSet. The set is created — and `obj` registered in it — only when we're
// about to descend into a child, which is also the only case where a cycle can
// occur. `obj` is re-added before each recursion (idempotent) so every level of
// the graph is guarded, matching the original always-add behavior.
export const deepFreeze = (obj: any, seen?: WeakSet<object>) => {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== "object" && typeof obj !== "function") return obj
    if (Object.isFrozen(obj) || seen?.has(obj)) return obj
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (item && typeof item === "object") {
                seen ??= new WeakSet()
                seen.add(obj)
                deepFreeze(item, seen)
            }
        }
    } else {
        const propNames = Object.getOwnPropertyNames(obj)
        for (const name of propNames) {
            const value = obj[name]
            if (value && typeof value === "object") {
                seen ??= new WeakSet()
                seen.add(obj)
                deepFreeze(value, seen)
            }
        }
    }
    return Object.freeze(obj)
}
