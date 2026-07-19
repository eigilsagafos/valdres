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
            return true
        }

        if (hasSet && a instanceof Set && b instanceof Set) {
            if (a.size !== b.size) return false
            it = a.entries()
            while (!(i = it.next()).done) {
                if (!b.has(i.value[0])) return false
                if (updatedAtomsSet?.has(i.value[0])) return false
            }
            return true
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
            return a.source === b.source && a.flags === b.flags
        // START: Modifications:
        // Apply guards for `Object.create(null)` handling. See:
        // - https://github.com/FormidableLabs/react-fast-compare/issues/64
        // - https://github.com/epoberezkin/fast-deep-equal/issues/49
        if (
            a.valueOf !== Object.prototype.valueOf &&
            typeof a.valueOf === "function" &&
            typeof b.valueOf === "function"
        )
            return a.valueOf() === b.valueOf()
        if (
            a.toString !== Object.prototype.toString &&
            typeof a.toString === "function" &&
            typeof b.toString === "function"
        )
            return a.toString() === b.toString()
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
