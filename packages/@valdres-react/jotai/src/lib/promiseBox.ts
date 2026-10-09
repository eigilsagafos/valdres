// Jotai stores promises as ordinary atom values. Valdres v1 atoms and selectors
// only hold synchronous values and reject thenables, so the adapter stores each
// thenable inside an inert box. One canonical box per thenable keeps Jotai's
// `Object.is` change detection: writing the same promise again is not a change.

export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
    typeof (value as { then?: unknown } | null | undefined)?.then === "function"

class PromiseBox {
    constructor(readonly promise: PromiseLike<unknown>) {
        Object.freeze(this)
    }
}

const boxes = new WeakMap<object, PromiseBox>()

export const encodeValue = (value: unknown): unknown => {
    if (!isPromiseLike(value)) return value
    let box = boxes.get(value)
    if (box === undefined) {
        box = new PromiseBox(value)
        boxes.set(value, box)
    }
    return box
}

export const decodeValue = (value: unknown): unknown =>
    value instanceof PromiseBox ? value.promise : value
