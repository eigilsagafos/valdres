const assertFreezable = (obj: object) => {
    if (Array.isArray(obj) || typeof obj === "function") return

    const prototype = Object.getPrototypeOf(obj)
    // A realm's Object.prototype is the sole object in its prototype chain.
    // Checking that shape as a fallback lets plain objects from other realms
    // remain supported without putting a cross-realm tag lookup on the hot path.
    if (
        prototype === null ||
        prototype === Object.prototype ||
        Object.getPrototypeOf(prototype) === null
    ) {
        return
    }

    const tag = Object.prototype.toString.call(obj).slice(8, -1)
    // Promises are opaque async handles: consumers cannot mutate their internal
    // state directly, and Valdres must be able to store pending ones. Their own
    // properties are still traversed and frozen below.
    // Ordinary class instances retain the standard "Object" tag and can have
    // their own property graph frozen just like plain objects. Built-ins and
    // host objects use a distinct brand and may hide mutable internal slots.
    if (tag === "Promise" || tag === "Error" || tag === "Object") return
    throw new TypeError(
        `valdres: deepFreeze cannot make ${tag} values immutable. Store an immutable plain-object/array representation, or define the containing atom or selector with { mutable: true }.`,
    )
}

// Plain/ordinary objects, arrays, functions, Errors, and opaque Promise handles
// can have their exposed property graph frozen without changing identity. Other
// built-ins and host objects may keep mutable internal slots after Object.freeze
// (Map/Set/Date/DataView), while typed arrays can throw during Object.freeze.
// Reject those values consistently and point atom/selector users to the
// explicit mutable contract.
//
// `seen` is the cycle guard, allocated lazily: a flat value (e.g. `{ title,
// body }`) has no nested objects to recurse into, so it never pays for a
// WeakSet. The set is created — and `obj` registered in it — only when we're
// about to descend into a child, which is also the only case where a cycle can
// occur. `obj` is re-added before each recursion (idempotent) so every level of
// the graph is guarded. Already-frozen containers are still traversed because
// Object.freeze is shallow and cannot prove their children are safe.
export const deepFreeze = (obj: any, seen?: WeakSet<object>) => {
    if (obj === null || obj === undefined) return obj
    if (typeof obj !== "object" && typeof obj !== "function") return obj
    assertFreezable(obj)
    if (seen?.has(obj)) return obj
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
