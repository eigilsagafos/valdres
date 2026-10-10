import { JotaiCompatibilityError } from "./errors"
import { nodes, type AnyAtomConfig } from "./nodeRegistry"

// Ports of Jotai 3.0.1's primitive read and write (MIT). The store recognizes
// `defaultRead` to read a primitive atom straight from its Valdres atom.
export function defaultRead(
    this: AnyAtomConfig,
    get: (atom: AnyAtomConfig) => unknown,
) {
    return get(this)
}

export function defaultWrite(
    this: AnyAtomConfig,
    get: (atom: AnyAtomConfig) => unknown,
    set: (atom: AnyAtomConfig, value: unknown) => unknown,
    arg: unknown,
) {
    return set(
        this,
        typeof arg === "function"
            ? (arg as (prev: unknown) => unknown)(get(this))
            : arg,
    )
}

const onMountSlots = new WeakMap<object, unknown>()

// A writable atom's Valdres definition includes a mount sentinel only when
// `onMount` exists the first time any Store uses the atom. Atoms created by
// this package keep `onMount` behind an accessor so a later assignment that
// could not take effect throws instead of being silently ignored.
export const atomPrototype: object = Object.create(Object.prototype, {
    onMount: {
        configurable: true,
        enumerable: false,
        get(this: object) {
            return onMountSlots.get(this)
        },
        set(this: AnyAtomConfig, onMount: unknown) {
            const node = nodes.get(this)
            if (
                node !== undefined &&
                node.lifecycle === undefined &&
                typeof onMount === "function" &&
                typeof this.write === "function"
            ) {
                throw new JotaiCompatibilityError(
                    "VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE",
                    `Cannot assign onMount to ${String(this)} after a store has used it. Assign onMount right after creating the atom.`,
                )
            }
            onMountSlots.set(this, onMount)
        },
    },
})

export const isOwnAtom = (config: object): boolean =>
    Object.getPrototypeOf(config) === atomPrototype
