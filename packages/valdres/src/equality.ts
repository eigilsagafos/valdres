const hasMap = typeof Map === "function"
const hasSet = typeof Set === "function"
const hasArrayBuffer =
    typeof ArrayBuffer === "function" &&
    typeof ArrayBuffer.isView === "function"
const hasSharedArrayBuffer = typeof SharedArrayBuffer === "function"
const arrayBufferPrototype =
    typeof ArrayBuffer === "function" ? ArrayBuffer.prototype : undefined
const sharedArrayBufferPrototype = hasSharedArrayBuffer
    ? SharedArrayBuffer.prototype
    : undefined

type IntrinsicGetter = (this: object) => unknown

const getIntrinsicGetter = (
    target: object | undefined,
    key: PropertyKey,
): IntrinsicGetter | undefined => {
    if (target === undefined) return undefined
    return Object.getOwnPropertyDescriptor(target, key)?.get
}

const arrayBufferByteLengthGetter = getIntrinsicGetter(
    arrayBufferPrototype,
    "byteLength",
)
const sharedArrayBufferByteLengthGetter = getIntrinsicGetter(
    sharedArrayBufferPrototype,
    "byteLength",
)
const dataViewByteLengthGetter = getIntrinsicGetter(
    typeof DataView === "function" ? DataView.prototype : undefined,
    "byteLength",
)
const typedArrayTagGetter = getIntrinsicGetter(
    typeof Uint8Array === "function"
        ? Object.getPrototypeOf(Uint8Array.prototype)
        : undefined,
    Symbol.toStringTag,
)
const typedArrayPrototype =
    typeof Uint8Array === "function"
        ? Object.getPrototypeOf(Uint8Array.prototype)
        : undefined
const typedArrayBufferGetter = getIntrinsicGetter(typedArrayPrototype, "buffer")
const typedArrayByteOffsetGetter = getIntrinsicGetter(
    typedArrayPrototype,
    "byteOffset",
)
const typedArrayByteLengthGetter = getIntrinsicGetter(
    typedArrayPrototype,
    "byteLength",
)
const dataViewBufferGetter = getIntrinsicGetter(
    typeof DataView === "function" ? DataView.prototype : undefined,
    "buffer",
)
const dataViewByteOffsetGetter = getIntrinsicGetter(
    typeof DataView === "function" ? DataView.prototype : undefined,
    "byteOffset",
)

const mapSizeGetter = getIntrinsicGetter(
    hasMap ? Map.prototype : undefined,
    "size",
)
const mapKeys = hasMap ? Map.prototype.keys : undefined
const mapHas = hasMap ? Map.prototype.has : undefined
const mapGet = hasMap ? Map.prototype.get : undefined
const setSizeGetter = getIntrinsicGetter(
    hasSet ? Set.prototype : undefined,
    "size",
)
const setValues = hasSet ? Set.prototype.values : undefined
const setHas = hasSet ? Set.prototype.has : undefined

const regExpSourceGetter = getIntrinsicGetter(RegExp.prototype, "source")
const regExpFlagGetters = [
    "hasIndices",
    "global",
    "ignoreCase",
    "multiline",
    "dotAll",
    "unicode",
    "unicodeSets",
    "sticky",
].map(key => getIntrinsicGetter(RegExp.prototype, key))

const dateValueOf = Date.prototype.valueOf
const numberValueOf = Number.prototype.valueOf
const stringValueOf = String.prototype.valueOf
const booleanValueOf = Boolean.prototype.valueOf
const bigintValueOf =
    typeof BigInt === "function" ? BigInt.prototype.valueOf : undefined
const symbolValueOf = Symbol.prototype.valueOf
const functionToString = Function.prototype.toString

const hasOwn = Object.prototype.hasOwnProperty
const isEnumerable = Object.prototype.propertyIsEnumerable

const sameValueZero = (left: unknown, right: unknown): boolean =>
    left === right || (left !== left && right !== right)

const equalBytes = (
    leftBuffer: ArrayBufferLike,
    leftByteOffset: number,
    rightBuffer: ArrayBufferLike,
    rightByteOffset: number,
    byteLength: number,
): boolean => {
    if (byteLength === 0) return true

    if (byteLength >= 64 && ((leftByteOffset | rightByteOffset) & 3) === 0) {
        const wordLength = Math.floor(byteLength / 4)
        const leftWords = new Uint32Array(
            leftBuffer,
            leftByteOffset,
            wordLength,
        )
        const rightWords = new Uint32Array(
            rightBuffer,
            rightByteOffset,
            wordLength,
        )
        for (let index = wordLength; index-- !== 0; ) {
            if (leftWords[index] !== rightWords[index]) return false
        }

        const wordByteLength = wordLength * 4
        const remaining = byteLength - wordByteLength
        if (remaining === 0) return true
        leftByteOffset += wordByteLength
        rightByteOffset += wordByteLength
        byteLength = remaining
    }

    const leftBytes = new Uint8Array(leftBuffer, leftByteOffset, byteLength)
    const rightBytes = new Uint8Array(rightBuffer, rightByteOffset, byteLength)
    for (let index = byteLength; index-- !== 0; ) {
        if (leftBytes[index] !== rightBytes[index]) return false
    }
    return true
}

const equalOwnSymbols = (
    left: Record<PropertyKey, unknown>,
    right: Record<PropertyKey, unknown>,
    leftSymbols: readonly symbol[],
    rightSymbols: readonly symbol[],
    state: ComparisonState,
): boolean => {
    let leftCount = 0
    for (let index = leftSymbols.length; index-- !== 0; ) {
        const key = leftSymbols[index]!
        if (!isEnumerable.call(left, key)) continue
        leftCount++
        if (!isEnumerable.call(right, key)) return false
        if (!deepEqualInternal(left[key], right[key], state)) return false
    }

    let rightCount = 0
    for (let index = rightSymbols.length; index-- !== 0; ) {
        if (isEnumerable.call(right, rightSymbols[index]!)) rightCount++
    }
    return leftCount === rightCount
}

const equalOwnEnumerable = (
    left: Record<PropertyKey, unknown>,
    right: Record<PropertyKey, unknown>,
    state: ComparisonState,
): boolean => {
    const leftKeys = Object.keys(left)
    if (leftKeys.length !== Object.keys(right).length) return false

    for (let index = leftKeys.length; index-- !== 0; ) {
        const key = leftKeys[index]!
        if (!hasOwn.call(right, key)) return false
        if (!deepEqualInternal(left[key], right[key], state)) return false
    }

    return equalOwnSymbols(
        left,
        right,
        Object.getOwnPropertySymbols(left),
        Object.getOwnPropertySymbols(right),
        state,
    )
}

const isDensePlainArray = (value: readonly unknown[], length: number) => {
    const keys = Reflect.ownKeys(value)
    return keys.length === length + 1 && keys[length] === "length"
}

interface BinaryDescriptor {
    readonly brand: string
    readonly buffer: ArrayBufferLike
    readonly byteOffset: number
    readonly byteLength: number
}

const intrinsicNumber = (
    getter: IntrinsicGetter | undefined,
    value: object,
): number => getter!.call(value) as number

const intrinsicBuffer = (
    getter: IntrinsicGetter | undefined,
    value: object,
): ArrayBufferLike => getter!.call(value) as ArrayBufferLike

const hasPrototypeGetter = (value: object, key: PropertyKey): boolean => {
    let prototype = Object.getPrototypeOf(value)
    while (prototype !== null) {
        if (
            typeof Object.getOwnPropertyDescriptor(prototype, key)?.get ===
            "function"
        ) {
            return true
        }
        prototype = Object.getPrototypeOf(prototype)
    }
    return false
}

const getBinaryDescriptor = (
    value: object,
    allowCrossRealmBufferProbe: boolean,
): BinaryDescriptor | undefined => {
    if (!hasArrayBuffer) return undefined

    if (ArrayBuffer.isView(value)) {
        const typedArrayTag = typedArrayTagGetter?.call(value)
        if (typeof typedArrayTag === "string") {
            return {
                brand: typedArrayTag,
                buffer: intrinsicBuffer(typedArrayBufferGetter, value),
                byteOffset: intrinsicNumber(typedArrayByteOffsetGetter, value),
                byteLength: intrinsicNumber(typedArrayByteLengthGetter, value),
            }
        }
        return {
            brand: "DataView",
            buffer: intrinsicBuffer(dataViewBufferGetter, value),
            byteOffset: intrinsicNumber(dataViewByteOffsetGetter, value),
            byteLength: intrinsicNumber(dataViewByteLengthGetter, value),
        }
    }

    if (value instanceof ArrayBuffer) {
        return {
            brand: "ArrayBuffer",
            buffer: value,
            byteOffset: 0,
            byteLength: intrinsicNumber(arrayBufferByteLengthGetter, value),
        }
    }
    if (hasSharedArrayBuffer && value instanceof SharedArrayBuffer) {
        return {
            brand: "SharedArrayBuffer",
            buffer: value,
            byteOffset: 0,
            byteLength: intrinsicNumber(
                sharedArrayBufferByteLengthGetter,
                value,
            ),
        }
    }
    if (!allowCrossRealmBufferProbe) return undefined
    if (!hasPrototypeGetter(value, "byteLength")) return undefined

    try {
        return {
            brand: "ArrayBuffer",
            buffer: value as ArrayBuffer,
            byteOffset: 0,
            byteLength: intrinsicNumber(arrayBufferByteLengthGetter, value),
        }
    } catch {
        // Try the other raw-buffer internal slot below.
    }
    if (hasSharedArrayBuffer) {
        try {
            return {
                brand: "SharedArrayBuffer",
                buffer: value as SharedArrayBuffer,
                byteOffset: 0,
                byteLength: intrinsicNumber(
                    sharedArrayBufferByteLengthGetter,
                    value,
                ),
            }
        } catch {
            return undefined
        }
    }
    return undefined
}

const isDomNode = (value: Record<PropertyKey, unknown>): boolean => {
    if (typeof Node !== "undefined" && value instanceof Node) return true
    return (
        typeof value.nodeType === "number" &&
        typeof value.nodeName === "string" &&
        typeof value.cloneNode === "function" &&
        "ownerDocument" in value
    )
}

const isStructurallyComparableObject = (value: object): boolean => {
    let prototype = Object.getPrototypeOf(value)
    if (prototype === null || prototype === Object.prototype) return true

    while (prototype !== null && prototype !== Object.prototype) {
        const constructor = Object.getOwnPropertyDescriptor(
            prototype,
            "constructor",
        )?.value
        if (
            typeof constructor === "function" &&
            /\{\s*\[native code\]\s*\}/.test(functionToString.call(constructor))
        ) {
            return false
        }
        prototype = Object.getPrototypeOf(prototype)
    }
    return true
}

interface ComparisonState {
    readonly leftAncestors: object[]
    readonly rightAncestors: object[]
}

const deepEqualInternal = (
    left: unknown,
    right: unknown,
    state?: ComparisonState,
): boolean => {
    if (sameValueZero(left, right)) return true
    if (
        left === null ||
        right === null ||
        typeof left !== "object" ||
        typeof right !== "object"
    ) {
        return false
    }

    const leftObject = left as Record<PropertyKey, unknown> & {
        readonly valueOf?: () => unknown
        readonly toString?: () => string
    }
    const rightObject = right as typeof leftObject

    const leftPrototype = Object.getPrototypeOf(leftObject)
    const rightPrototype = Object.getPrototypeOf(rightObject)
    const prototypesMatch = leftPrototype === rightPrototype
    const leftBinary = getBinaryDescriptor(
        leftObject,
        !prototypesMatch ||
            (leftPrototype !== null &&
                leftPrototype !== Object.prototype &&
                leftPrototype !== arrayBufferPrototype &&
                (!hasSharedArrayBuffer ||
                    leftPrototype !== sharedArrayBufferPrototype)),
    )
    const rightBinary = getBinaryDescriptor(
        rightObject,
        !prototypesMatch ||
            (rightPrototype !== null &&
                rightPrototype !== Object.prototype &&
                rightPrototype !== arrayBufferPrototype &&
                (!hasSharedArrayBuffer ||
                    rightPrototype !== sharedArrayBufferPrototype)),
    )
    if (
        !prototypesMatch &&
        (leftBinary === undefined ||
            rightBinary === undefined ||
            leftBinary.brand !== rightBinary.brand)
    ) {
        return false
    }

    const comparisonState = state ?? {
        leftAncestors: [],
        rightAncestors: [],
    }
    if (
        comparisonState.leftAncestors.includes(leftObject) ||
        comparisonState.rightAncestors.includes(rightObject)
    ) {
        return false
    }
    comparisonState.leftAncestors.push(leftObject)
    comparisonState.rightAncestors.push(rightObject)

    try {
        return deepEqualObjects(
            leftObject,
            rightObject,
            comparisonState,
            leftBinary,
            rightBinary,
        )
    } finally {
        comparisonState.leftAncestors.pop()
        comparisonState.rightAncestors.pop()
    }
}

const deepEqualObjects = (
    leftObject: Record<PropertyKey, unknown> & {
        readonly valueOf?: () => unknown
        readonly toString?: () => string
    },
    rightObject: Record<PropertyKey, unknown> & {
        readonly valueOf?: () => unknown
        readonly toString?: () => string
    },
    state: ComparisonState,
    leftBinary: BinaryDescriptor | undefined,
    rightBinary: BinaryDescriptor | undefined,
): boolean => {
    if (Array.isArray(leftObject)) {
        if (!Array.isArray(rightObject)) return false
        const length = leftObject.length
        if (length !== rightObject.length) return false
        for (let index = length; index-- !== 0; ) {
            if (
                !deepEqualInternal(leftObject[index], rightObject[index], state)
            ) {
                return false
            }
        }
        if (
            !isDensePlainArray(leftObject, length) ||
            !isDensePlainArray(rightObject, length)
        ) {
            return equalOwnEnumerable(leftObject, rightObject, state)
        }
        return true
    }

    if (hasMap && (leftObject instanceof Map || rightObject instanceof Map)) {
        if (!(leftObject instanceof Map) || !(rightObject instanceof Map)) {
            return false
        }
        let leftSize: number
        let rightSize: number
        try {
            leftSize = mapSizeGetter!.call(leftObject) as number
            rightSize = mapSizeGetter!.call(rightObject) as number
        } catch {
            return false
        }
        if (leftSize !== rightSize) return false
        for (const key of mapKeys!.call(leftObject) as Iterable<unknown>) {
            if (!mapHas!.call(rightObject, key)) return false
            if (
                !deepEqualInternal(
                    mapGet!.call(leftObject, key),
                    mapGet!.call(rightObject, key),
                    state,
                )
            ) {
                return false
            }
        }
        return equalOwnEnumerable(leftObject, rightObject, state)
    }

    if (hasSet && (leftObject instanceof Set || rightObject instanceof Set)) {
        if (!(leftObject instanceof Set) || !(rightObject instanceof Set)) {
            return false
        }
        let leftSize: number
        let rightSize: number
        try {
            leftSize = setSizeGetter!.call(leftObject) as number
            rightSize = setSizeGetter!.call(rightObject) as number
        } catch {
            return false
        }
        if (leftSize !== rightSize) return false
        for (const value of setValues!.call(leftObject) as Iterable<unknown>) {
            if (!setHas!.call(rightObject, value)) return false
        }
        return equalOwnEnumerable(leftObject, rightObject, state)
    }

    if (leftBinary !== undefined || rightBinary !== undefined) {
        if (
            leftBinary === undefined ||
            rightBinary === undefined ||
            leftBinary.brand !== rightBinary.brand ||
            leftBinary.byteLength !== rightBinary.byteLength
        ) {
            return false
        }
        return equalBytes(
            leftBinary.buffer,
            leftBinary.byteOffset,
            rightBinary.buffer,
            rightBinary.byteOffset,
            leftBinary.byteLength,
        )
    }

    if (leftObject instanceof RegExp || rightObject instanceof RegExp) {
        if (
            !(leftObject instanceof RegExp) ||
            !(rightObject instanceof RegExp)
        ) {
            return false
        }
        try {
            if (
                regExpSourceGetter!.call(leftObject) !==
                regExpSourceGetter!.call(rightObject)
            ) {
                return false
            }
            for (const getter of regExpFlagGetters) {
                if (
                    getter !== undefined &&
                    getter.call(leftObject) !== getter.call(rightObject)
                ) {
                    return false
                }
            }
        } catch {
            return false
        }
        return equalOwnEnumerable(leftObject, rightObject, state)
    }

    if (leftObject instanceof Date || rightObject instanceof Date) {
        if (!(leftObject instanceof Date) || !(rightObject instanceof Date)) {
            return false
        }
        try {
            if (
                !sameValueZero(
                    dateValueOf.call(leftObject),
                    dateValueOf.call(rightObject),
                )
            ) {
                return false
            }
        } catch {
            return false
        }
        return equalOwnEnumerable(leftObject, rightObject, state)
    }

    const boxedValueOf =
        leftObject instanceof Number || rightObject instanceof Number
            ? numberValueOf
            : leftObject instanceof String || rightObject instanceof String
              ? stringValueOf
              : leftObject instanceof Boolean || rightObject instanceof Boolean
                ? booleanValueOf
                : typeof BigInt === "function" &&
                    (leftObject instanceof BigInt ||
                        rightObject instanceof BigInt)
                  ? bigintValueOf
                  : leftObject instanceof Symbol ||
                      rightObject instanceof Symbol
                    ? symbolValueOf
                    : undefined
    if (boxedValueOf !== undefined) {
        try {
            if (
                !sameValueZero(
                    boxedValueOf.call(leftObject),
                    boxedValueOf.call(rightObject),
                )
            ) {
                return false
            }
        } catch {
            return false
        }
        return equalOwnEnumerable(leftObject, rightObject, state)
    }

    const leftPrototype = Object.getPrototypeOf(leftObject)
    const rightPrototype = Object.getPrototypeOf(rightObject)
    const leftIsPlain =
        leftPrototype === null || leftPrototype === Object.prototype
    const rightIsPlain =
        rightPrototype === null || rightPrototype === Object.prototype
    if (
        (!leftIsPlain &&
            (isDomNode(leftObject) ||
                !isStructurallyComparableObject(leftObject))) ||
        (!rightIsPlain &&
            (isDomNode(rightObject) ||
                !isStructurallyComparableObject(rightObject)))
    ) {
        return false
    }

    const leftValueOf = leftObject.valueOf
    const rightValueOf = rightObject.valueOf
    const hasCustomValueOf =
        (typeof leftValueOf === "function" &&
            leftValueOf !== Object.prototype.valueOf) ||
        (typeof rightValueOf === "function" &&
            rightValueOf !== Object.prototype.valueOf)
    if (hasCustomValueOf) {
        if (
            typeof leftValueOf !== "function" ||
            typeof rightValueOf !== "function"
        ) {
            return false
        }
        const leftValue = leftValueOf.call(leftObject)
        const rightValue = rightValueOf.call(rightObject)
        const leftIsPrimitive =
            leftValue === null ||
            (typeof leftValue !== "object" && typeof leftValue !== "function")
        const rightIsPrimitive =
            rightValue === null ||
            (typeof rightValue !== "object" && typeof rightValue !== "function")
        if (leftIsPrimitive !== rightIsPrimitive) return false
        if (leftIsPrimitive && !sameValueZero(leftValue, rightValue)) {
            return false
        }
    } else {
        const leftToString = leftObject.toString
        const rightToString = rightObject.toString
        const hasCustomToString =
            (typeof leftToString === "function" &&
                leftToString !== Object.prototype.toString) ||
            (typeof rightToString === "function" &&
                rightToString !== Object.prototype.toString)
        if (hasCustomToString) {
            if (
                typeof leftToString !== "function" ||
                typeof rightToString !== "function" ||
                leftToString.call(leftObject) !==
                    rightToString.call(rightObject)
            ) {
                return false
            }
        }
    }

    const leftKeys = Object.keys(leftObject)
    if (leftKeys.length !== Object.keys(rightObject).length) return false
    for (let index = leftKeys.length; index-- !== 0; ) {
        if (!hasOwn.call(rightObject, leftKeys[index]!)) return false
    }

    for (let index = leftKeys.length; index-- !== 0; ) {
        const key = leftKeys[index]!
        if (
            (key === "_owner" || key === "__v" || key === "__o") &&
            leftObject.$$typeof
        ) {
            continue
        }
        if (!deepEqualInternal(leftObject[key], rightObject[key], state)) {
            return false
        }
    }

    const leftSymbols = Object.getOwnPropertySymbols(leftObject)
    const rightSymbols = Object.getOwnPropertySymbols(rightObject)
    if (leftSymbols.length !== 0 || rightSymbols.length !== 0) {
        return equalOwnSymbols(
            leftObject,
            rightObject,
            leftSymbols,
            rightSymbols,
            state,
        )
    }

    return true
}

/**
 * Compares supported values recursively. Primitive leaves use SameValueZero,
 * object properties are limited to own enumerable string and symbol keys, and
 * Map keys plus Set members retain their native identity semantics.
 *
 * Circular structures are unsupported. Getters, Proxy traps, `valueOf`, and
 * `toString` hooks reached during comparison may run and may throw.
 */
export const deepEqual = (left: unknown, right: unknown): boolean =>
    deepEqualInternal(left, right)
