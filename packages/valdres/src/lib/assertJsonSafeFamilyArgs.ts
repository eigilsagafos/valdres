/** Where and why a family arg fails the JSON round-trip. */
type Offense = { path: string; reason: string }

const offense = (path: string, reason: string): Offense => ({ path, reason })

/** `args[0].user["odd key"]` — property access when the key is an identifier,
 * bracketed otherwise, so the path can be pasted back into the call site. */
const propertyPath = (path: string, key: string) =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `${path}.${key}`
        : `${path}[${JSON.stringify(key)}]`

/** Walk one family arg, returning the first value whose JSON DATA does not
 * survive `JSON.parse(JSON.stringify(value))` unchanged — either because JSON
 * cannot represent it at all (BigInt throws, Date/Map/Set/undefined/NaN change
 * type) or because the parsed result is a structurally different value that
 * the family key codec would encode differently (-0, null-prototype objects,
 * sparse holes).
 *
 * Data is the deliberate boundary. JSON also drops everything ABOUT a value
 * that isn't its data — descriptor bits (`writable`, `configurable`),
 * extensibility (frozen/sealed), and object identity, so two references to one
 * object come back as two objects. A `keyOf` that reads any of those does
 * derive a different key after hydration, but this walk cannot be the place to
 * catch it:
 *
 * - Rejecting frozen/sealed args would fire on ordinary code. valdres's own
 *   dev-mode `deepFreeze` freezes every value written to an atom, so the
 *   common `store.set(family(entity), entity)` leaves a FROZEN arg behind —
 *   this dev-only guard would throw on the dev-only freeze.
 * - Descriptor and extensibility checks wouldn't close the hole anyway:
 *   aliasing (`family([shared, shared])`) diverges identically and no
 *   descriptor check sees it.
 *
 * So the contract is narrowed instead of chased: for a NAMED (transferable)
 * family, `keyOf` must derive its key from the args' JSON data. That is what
 * every real `keyOf` does — `entity => entity.id` — and it is documented on
 * the atomFamily page.
 *
 * Containers are checked by their own keys, not just their contents: a
 * property JSON drops (symbol-keyed, non-enumerable, a non-index property on
 * an array) or a `toJSON` hook that rewrites the value wholesale changes the
 * parsed result just as surely as a `Date` does — and a `keyOf` reading such a
 * property would see something different on the hydrating side.
 *
 * The traversal mirrors `stringifyFamilyArgs`: exact built-ins are routed by
 * prototype, and values are read off data descriptors — a getter is reported,
 * never invoked. */
const findOffense = (
    value: unknown,
    path: string,
    active: WeakSet<object>,
): Offense | undefined => {
    switch (typeof value) {
        case "string":
        case "boolean":
            return undefined
        case "number":
            if (Number.isNaN(value)) return offense(path, "NaN")
            if (value === Infinity) return offense(path, "Infinity")
            if (value === -Infinity) return offense(path, "-Infinity")
            // JSON has no signed zero: it round-trips to +0, which the family
            // key codec deliberately keeps distinct from -0.
            if (Object.is(value, -0)) return offense(path, "-0")
            return undefined
        case "bigint":
            return offense(path, "a BigInt")
        case "undefined":
            return offense(path, "undefined")
        case "symbol":
            return offense(path, "a symbol")
        case "function":
            return offense(path, "a function")
    }

    if (value === null) return undefined
    if (typeof value !== "object") return offense(path, typeof value)

    if (active.has(value)) return offense(path, "a circular reference")

    if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
            return offense(path, "an Array subclass")
        }
        active.add(value)
        try {
            // JSON.stringify writes an array's index elements and nothing
            // else, so any other own property silently vanishes from the
            // payload — and a `toJSON` hook replaces the array wholesale.
            // Either way the parsed value differs from this one, which is what
            // a keyOf reading such a property would see on the hydrating side.
            for (const key of Reflect.ownKeys(value)) {
                if (typeof key === "symbol") {
                    return offense(path, "a symbol-keyed property")
                }
                if (key === "length") continue
                // Read the descriptor rather than the property: an accessor
                // `toJSON` must not be invoked, and it isn't a hook anyway —
                // it falls through to the non-index rejection below.
                if (
                    key === "toJSON" &&
                    typeof Object.getOwnPropertyDescriptor(value, key)!.value ===
                        "function"
                ) {
                    return offense(path, "an array with a toJSON hook")
                }
                const index = Number(key)
                if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index >= value.length ||
                    String(index) !== key
                ) {
                    return offense(
                        propertyPath(path, key),
                        "a non-index array property",
                    )
                }
            }
            for (let index = 0; index < value.length; index++) {
                const elementPath = `${path}[${index}]`
                const descriptor = Object.getOwnPropertyDescriptor(value, index)
                // A hole stringifies as null, so the parsed array has a value
                // where this one has none.
                if (descriptor === undefined) {
                    return offense(elementPath, "a sparse-array hole")
                }
                // Read the data descriptor rather than the element: a getter
                // is reported, never invoked (as in stringifyFamilyArgs).
                if (!("value" in descriptor)) {
                    return offense(elementPath, "an accessor property")
                }
                const found = findOffense(
                    descriptor.value,
                    elementPath,
                    active,
                )
                if (found) return found
            }
        } finally {
            active.delete(value)
        }
        return undefined
    }

    const prototype = Object.getPrototypeOf(value)

    if (prototype === Object.prototype) {
        active.add(value)
        try {
            for (const key of Reflect.ownKeys(value)) {
                if (typeof key === "symbol") {
                    return offense(path, "a symbol-keyed property")
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, key)!
                // JSON.stringify calls a `toJSON` hook regardless of
                // enumerability, replacing the whole object in the payload.
                if (
                    key === "toJSON" &&
                    typeof descriptor.value === "function"
                ) {
                    return offense(path, "an object with a toJSON hook")
                }
                if (!descriptor.enumerable) {
                    return offense(
                        propertyPath(path, key),
                        "a non-enumerable property",
                    )
                }
                if (!("value" in descriptor)) {
                    return offense(
                        propertyPath(path, key),
                        "an accessor property",
                    )
                }
                const found = findOffense(
                    descriptor.value,
                    propertyPath(path, key),
                    active,
                )
                if (found) return found
            }
        } finally {
            active.delete(value)
        }
        return undefined
    }

    // Everything below stringifies without throwing, which is exactly what
    // makes it dangerous: the payload looks fine and the phantom member only
    // shows up on the hydrating side.
    if (prototype === null) return offense(path, "a null-prototype object")
    if (prototype === Date.prototype) return offense(path, "a Date")
    if (prototype === Map.prototype) return offense(path, "a Map")
    if (prototype === Set.prototype) return offense(path, "a Set")

    const name = (value as { constructor?: { name?: string } }).constructor?.name
    return offense(path, name ? `a ${name} instance` : "a non-plain object")
}

/** Dev-only guard on the args half of a `families` payload entry.
 *
 * `dehydrate` emits `familyArgs` raw — the wire codec covers member VALUES
 * only — and `hydrate` re-derives the member with `family(...args)` from the
 * JSON-parsed payload. So an arg that does not survive a JSON round-trip
 * either makes `JSON.stringify(payload)` throw (BigInt) or, worse, silently
 * resolves to a DIFFERENT member on the hydrating side: a `Date` key comes
 * back as its ISO string, `NaN` as `null`, a `Map` as `{}`. The value lands on
 * a phantom member nothing reads, and the real member keeps its default.
 *
 * The `FamilyKey` type accepts all of these because the key codec is a
 * local-identity concern; transferability is a stricter, dehydrate-only
 * contract. Rather than leave it documented-but-unenforced, fail loudly on the
 * server where the bug is — mirroring `encodeWireValue`'s throw on a value
 * that fails its own schema's encode.
 *
 * Dev only (`!IS_PROD` at the call site): production pays a folded-away branch,
 * and a payload that dev never rejected cannot start failing in production. */
export const assertJsonSafeFamilyArgs = (
    name: string,
    args: readonly unknown[],
): void => {
    const active = new WeakSet<object>()
    for (let index = 0; index < args.length; index++) {
        const found = findOffense(args[index], `args[${index}]`, active)
        if (found === undefined) continue
        throw new TypeError(
            `valdres: dehydrate cannot serialize a '${name}' member — ${found.path} is ${found.reason}, which JSON does not round-trip. ` +
                `Family args cross the wire raw, and hydrate re-derives the member with ${name}(...args), so this entry would land on a different member. ` +
                `Key transferred families by strings and numbers (e.g. date.toISOString()).`,
        )
    }
}
