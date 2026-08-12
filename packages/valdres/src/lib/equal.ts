const hasElementType = typeof Element !== "undefined"
const hasMap = typeof Map === "function"
const hasSet = typeof Set === "function"
const hasArrayBuffer = typeof ArrayBuffer === "function" && !!ArrayBuffer.isView
const hasSharedArrayBuffer = typeof SharedArrayBuffer === "function"

// Compare the bytes exposed by a buffer or view, not the values produced by a
// typed-array index. Value comparison loses binary distinctions such as +0/-0
// and NaN payloads. Temporary integer views are allocated only for binary
// inputs; the ordinary object/array equality hot paths never call this. Larger
// aligned regions use 32-bit words to quarter loop overhead, then compare any
// trailing bytes separately.
const equalBytes = (
    aBuffer: any,
    aByteOffset: number,
    bBuffer: any,
    bByteOffset: number,
    byteLength: number,
) => {
    if (byteLength === 0) return true

    if (byteLength >= 64 && ((aByteOffset | bByteOffset) & 3) === 0) {
        const wordLength = Math.floor(byteLength / 4)
        const aWords = new Uint32Array(aBuffer, aByteOffset, wordLength)
        const bWords = new Uint32Array(bBuffer, bByteOffset, wordLength)
        for (let i = wordLength; i-- !== 0; ) {
            if (aWords[i] !== bWords[i]) return false
        }

        const wordByteLength = wordLength * 4
        const remaining = byteLength - wordByteLength
        if (remaining === 0) return true
        aByteOffset += wordByteLength
        bByteOffset += wordByteLength
        byteLength = remaining
    }

    const aBytes = new Uint8Array(aBuffer, aByteOffset, byteLength)
    const bBytes = new Uint8Array(bBuffer, bByteOffset, byteLength)
    for (let i = byteLength; i-- !== 0; ) {
        if (aBytes[i] !== bBytes[i]) return false
    }
    return true
}

const hasOwn = Object.prototype.hasOwnProperty
const isEnumerable = Object.prototype.propertyIsEnumerable

// Own enumerable properties keyed by a symbol are invisible to `Object.keys`,
// so without this two values differing only in one compare equal — and a `set`
// carrying that difference is dropped with no warning. Only reached when a
// symbol key exists on either side, which the caller establishes with an
// existence check costing ~4ns a call on a plain object (the engine answers it
// from the shape, without walking indexed storage).
const equalOwnSymbols = (
    a: any,
    b: any,
    aSymbols: symbol[],
    bSymbols: symbol[],
    updatedAtomsSet?: Set<any>,
) => {
    let aCount = 0
    for (let i = aSymbols.length; i-- !== 0; ) {
        const key = aSymbols[i]!
        // Non-enumerable symbols are ignored, exactly as non-enumerable string
        // keys are — `Object.keys` never sees those either.
        if (!isEnumerable.call(a, key)) continue
        aCount++
        if (!isEnumerable.call(b, key)) return false
        if (!deepEqualFn(a[key], b[key], updatedAtomsSet)) return false
    }
    let bCount = 0
    for (let i = bSymbols.length; i-- !== 0; )
        if (isEnumerable.call(b, bSymbols[i]!)) bCount++
    return aCount === bCount
}

// Whether an array is exactly its elements: `length` dense indices and nothing
// else. A COUNT alone cannot answer this — a hole offsets an expando exactly,
// so `[1, , 3]` with a `cursor` prop reports the same number of own keys as a
// dense 3-element array, and comparing counts silently readmits the write drop
// this check exists to stop. Own-key order settles it: `length` is created with
// the array, before any user property, so it directly follows the index keys —
// finding it at position `length` proves the indices are dense, and the count
// then proves nothing follows it. Anything else (a hole, an expando, a symbol,
// an exotic key order from a Proxy) is routed to the exact comparison, so this
// can only ever be conservative.
const isDensePlainArray = (a: any, length: number) => {
    const keys = Reflect.ownKeys(a)
    return keys.length === length + 1 && keys[length] === "length"
}

// Full own-enumerable comparison for values carrying more than the state their
// fast path compares: an array with an expando (`rows.cursor = "..."`), a
// symbol key or a hole, or a Map/Set/RegExp with properties attached beside its
// entries. For arrays both sides are re-compared by key, which re-visits the
// indices — that runs only once the cheap index loop has already reported
// equality, so the redundancy buys a much cheaper common case.
const equalOwnEnumerable = (a: any, b: any, updatedAtomsSet?: Set<any>) => {
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (let i = keys.length; i-- !== 0; ) {
        const key = keys[i]!
        if (!hasOwn.call(b, key)) return false
        if (!deepEqualFn(a[key], b[key], updatedAtomsSet)) return false
    }
    return equalOwnSymbols(
        a,
        b,
        Object.getOwnPropertySymbols(a),
        Object.getOwnPropertySymbols(b),
        updatedAtomsSet,
    )
}

const deepEqualFn = (a: any, b: any, updatedAtomsSet?: Set<any>) => {
    if (updatedAtomsSet) {
        if (updatedAtomsSet.has(a) || updatedAtomsSet.has(b)) return false
    }
    if (a === b) return true

    if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) {
            // Constructor identity differs between realms. Preserve the normal
            // fast rejection for unrelated values, but admit matching binary
            // brands so the byte-aware paths below also work across realms.
            let matchingBinaryBrands = false
            if (hasArrayBuffer) {
                const aIsView = ArrayBuffer.isView(a)
                const bIsView = ArrayBuffer.isView(b)
                if (aIsView && bIsView) {
                    matchingBinaryBrands =
                        Object.prototype.toString.call(a) ===
                        Object.prototype.toString.call(b)
                } else if (
                    !aIsView &&
                    !bIsView &&
                    typeof a.byteLength === "number" &&
                    typeof b.byteLength === "number"
                ) {
                    const aTag = Object.prototype.toString.call(a)
                    matchingBinaryBrands =
                        (aTag === "[object ArrayBuffer]" ||
                            aTag === "[object SharedArrayBuffer]") &&
                        aTag === Object.prototype.toString.call(b)
                }
            }
            if (!matchingBinaryBrands) return false
        }

        var length, i, keys
        if (Array.isArray(a)) {
            length = a.length
            if (length != b.length) return false
            for (i = length; i-- !== 0; )
                if (!deepEqualFn(a[i], b[i], updatedAtomsSet)) return false
            // Equal elements is not equal values: an array can also carry
            // expando and symbol-keyed own props, which the loop above cannot
            // see. Enumerating an array's keys is O(n) with a large constant
            // on both engines, because every index has to be materialized as a
            // string: measured per pair, 106ns on JSC and 185ns on V8 at 3
            // elements, ~4µs at 100, against 2.3ns/51ns for the loop itself.
            // No cheaper exact test exists — `getOwnPropertySymbols` is the
            // only own-key API that skips indexed storage, and it cannot see
            // an expando. So the cost is spent only here, once the arrays are
            // otherwise equal; identity and every early-exit rejection above
            // return before reaching it.
            if (!isDensePlainArray(a, length) || !isDensePlainArray(b, length))
                return equalOwnEnumerable(a, b, updatedAtomsSet)
            return true
        }

        // START: Modifications:
        // 1. Extra `has<Type> &&` helpers in initial condition allow es6 code
        //    to co-exist with es5.
        // 2. Replace `for of` with es5 compliant iteration using `for`.
        //    Basically, take:
        //
        //    ```js
        //    for (i of a.entries())
        //      if (!b.has(i[0])) return false;
        //    ```
        //
        //    ... and convert to:
        //
        //    ```js
        //    it = a.entries();
        //    while (!(i = it.next()).done)
        //      if (!b.has(i.value[0])) return false;
        //    ```
        //
        //    **Note**: `i` access switches to `i.value`.
        var it
        if (hasMap && a instanceof Map && b instanceof Map) {
            if (a.size !== b.size) return false
            it = a.entries()
            while (!(i = it.next()).done) if (!b.has(i.value[0])) return false
            it = a.entries()
            while (!(i = it.next()).done)
                if (
                    !deepEqualFn(i.value[1], b.get(i.value[0]), updatedAtomsSet)
                )
                    return false
            // Entries are a Map's state but not all of it — a property
            // attached beside them is a difference too, on the same argument
            // as an array expando. Neither a Map nor a Set has indexed
            // storage, so unlike an array this costs ~4ns.
            return equalOwnEnumerable(a, b, updatedAtomsSet)
        }

        if (hasSet && a instanceof Set && b instanceof Set) {
            if (a.size !== b.size) return false
            it = a.entries()
            while (!(i = it.next()).done) {
                if (!b.has(i.value[0])) return false
                if (updatedAtomsSet?.has(i.value[0])) return false
            }
            return equalOwnEnumerable(a, b, updatedAtomsSet)
        }
        // END: Modifications

        if (hasArrayBuffer) {
            if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
                // TypeScript narrows this to ArrayBufferView, whose safe common
                // surface intentionally omits typed-array-only indexed fields.
                // The runtime `.length` check below separates typed arrays from
                // DataView before any such field is used.
                const aView: any = a
                const bView: any = b
                // Typed arrays expose indexed values. Keep their established
                // allocation-free element loop, adding raw-byte fallback only
                // for the two IEEE-754 ambiguities. DataView has no `.length`,
                // so it always takes the byte path below.
                length = aView.length
                if (typeof length === "number") {
                    if (length !== bView.length) return false
                    // One-byte integer views already expose individual bytes,
                    // which is the dominant binary-state case. Avoid even the
                    // type-tag lookup for this path.
                    if (aView.BYTES_PER_ELEMENT === 1) {
                        for (i = length; i-- !== 0; ) {
                            if (aView[i] !== bView[i]) return false
                        }
                        return true
                    }
                    const viewTag = aView[Symbol.toStringTag]
                    if (
                        viewTag !== "Float16Array" &&
                        viewTag !== "Float32Array" &&
                        viewTag !== "Float64Array"
                    ) {
                        for (i = length; i-- !== 0; ) {
                            if (aView[i] !== bView[i]) return false
                        }
                        return true
                    }
                    for (i = length; i-- !== 0; ) {
                        const aValue = aView[i]
                        const bValue = bView[i]
                        if (aValue !== bValue) {
                            // Equal NaN values can carry different payload bits,
                            // which only a byte comparison can distinguish.
                            if (aValue !== aValue && bValue !== bValue) {
                                return equalBytes(
                                    aView.buffer,
                                    aView.byteOffset,
                                    bView.buffer,
                                    bView.byteOffset,
                                    aView.byteLength,
                                )
                            }
                            return false
                        }
                        // Numeric equality collapses +0 and -0, but their bytes
                        // (and therefore binary state) are different.
                        if (aValue === 0 && 1 / aValue !== 1 / bValue) {
                            return false
                        }
                    }
                    return true
                }

                length = aView.byteLength
                if (length !== bView.byteLength) return false
                return equalBytes(
                    aView.buffer,
                    aView.byteOffset,
                    bView.buffer,
                    bView.byteOffset,
                    length,
                )
            }

            if (
                a instanceof ArrayBuffer ||
                (hasSharedArrayBuffer && a instanceof SharedArrayBuffer) ||
                (typeof a.byteLength === "number" &&
                    (Object.prototype.toString.call(a) ===
                        "[object ArrayBuffer]" ||
                        Object.prototype.toString.call(a) ===
                            "[object SharedArrayBuffer]"))
            ) {
                length = a.byteLength
                if (length !== b.byteLength) return false
                return equalBytes(a, 0, b, 0, length)
            }
        }

        if (a.constructor === RegExp)
            return (
                a.source === b.source &&
                a.flags === b.flags &&
                equalOwnEnumerable(a, b, updatedAtomsSet)
            )
        // START: Modifications:
        // Apply guards for `Object.create(null)` handling. See:
        // - https://github.com/FormidableLabs/react-fast-compare/issues/64
        // - https://github.com/epoberezkin/fast-deep-equal/issues/49
        // A custom `valueOf`/`toString` describes only PART of a value — a
        // Date's instant, a wrapper's primitive, a class's display form — so a
        // mismatch is decisive but a match is not. Returning true on a match
        // makes `new Money(5, "USD")` equal `new Money(5, "EUR")` and drops
        // that write, so both now narrow the answer and fall through to the
        // own-property comparison instead of standing in for it.
        if (
            a.valueOf !== Object.prototype.valueOf &&
            typeof a.valueOf === "function" &&
            typeof b.valueOf === "function"
        ) {
            const aValue = a.valueOf()
            const bValue = b.valueOf()
            if (
                // An object result (`valueOf() { return this }`) says nothing
                // about equality; only a primitive one is a verdict.
                (aValue === null || typeof aValue !== "object") &&
                (bValue === null || typeof bValue !== "object") &&
                aValue !== bValue &&
                // Two invalid Dates are one value, not two unequal NaNs.
                (aValue === aValue || bValue === bValue)
            )
                return false
        } else if (
            // `else`, so a value with a custom valueOf never also pays for
            // toString — that is the original control flow, and it matters:
            // Date.prototype.toString formats a full date string, ~120ns a
            // call. Anything it could add is now covered by the own-property
            // comparison below.
            a.toString !== Object.prototype.toString &&
            typeof a.toString === "function" &&
            typeof b.toString === "function" &&
            a.toString() !== b.toString()
        )
            return false
        // END: Modifications

        keys = Object.keys(a)
        length = keys.length
        if (length !== Object.keys(b).length) return false

        for (i = length; i-- !== 0; )
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false
        // END: fast-deep-equal

        // START: react-fast-compare
        // custom handling for DOM elements
        if (hasElementType && a instanceof Element) return false

        // custom handling for React/Preact
        for (i = length; i-- !== 0; ) {
            if (
                (keys[i] === "_owner" ||
                    keys[i] === "__v" ||
                    keys[i] === "__o") &&
                a.$$typeof
            ) {
                // React-specific: avoid traversing React elements' _owner
                // Preact-specific: avoid traversing Preact elements' __v and __o
                //    __v = $_original / $_vnode
                //    __o = $_owner
                // These properties contain circular references and are not needed when
                // comparing the actual elements (and not their owners)
                // .$$typeof and ._store on just reasonable markers of elements

                continue
            }

            // all other properties should be traversed as usual
            if (!deepEqualFn(a[keys[i]], b[keys[i]], updatedAtomsSet))
                return false
        }
        // END: react-fast-compare

        // `Object.keys` is blind to symbol-keyed props, so a value differing
        // only in one would compare equal and its write would be dropped. This
        // sits last so that a difference in a string-keyed prop — the common
        // reason two values differ — is found before anything is spent here.
        const aSymbols = Object.getOwnPropertySymbols(a)
        const bSymbols = Object.getOwnPropertySymbols(b)
        if (aSymbols.length !== 0 || bSymbols.length !== 0)
            return equalOwnSymbols(a, b, aSymbols, bSymbols, updatedAtomsSet)

        // START: fast-deep-equal
        return true
    }

    return a !== a && b !== b
}
// end fast-deep-equal

export const equal = (a: any, b: any, updatedAtomsSet?: Set<any>) => {
    try {
        return deepEqualFn(a, b, updatedAtomsSet)
    } catch (error) {
        // @ts-ignore
        if ((error.message || "").match(/stack|recursion/i)) {
            // warn on circular references, don't crash
            // browsers give this different errors name and messages:
            // chrome/safari: "RangeError", "Maximum call stack size exceeded"
            // firefox: "InternalError", too much recursion"
            // edge: "Error", "Out of stack space"
            console.warn("react-fast-compare cannot handle circular refs")
            return false
        }
        // some other error. we should definitely know about these
        throw error
    }
}
