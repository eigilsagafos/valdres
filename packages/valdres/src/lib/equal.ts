const hasElementType = typeof Element !== "undefined"
const hasMap = typeof Map === "function"
const hasSet = typeof Set === "function"
const hasArrayBuffer = typeof ArrayBuffer === "function" && !!ArrayBuffer.isView

const deepEqualFn = (a: any, b: any, updatedAtomsSet?: Set<any>) => {
    if (updatedAtomsSet) {
        if (updatedAtomsSet.has(a) || updatedAtomsSet.has(b)) return false
    }
    if (a === b) return true

    if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false

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

        if (hasArrayBuffer && ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
            // @ts-ignore
            length = a.length
            // @ts-ignore
            if (length != b.length) return false
            // @ts-ignore
            for (i = length; i-- !== 0; ) if (a[i] !== b[i]) return false
            return true
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
