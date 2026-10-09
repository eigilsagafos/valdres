import type { Atom, State } from "valdres"

/**
 * The atom-level writes one Recoil action resolves to, in first-write order
 * with the last value winning, as Recoil's `writes` map does. `RESET` removes
 * the atom's stored value.
 */
export type AtomWrites = Map<Atom<any>, unknown>

export const RESET: unique symbol = Symbol("reset")

/**
 * A writable node turns a value (or `DefaultValue`) into atom writes. Reads
 * through `read` see the state before this action's writes, as Recoil's
 * selector `set` handlers do.
 */
export interface WriteContext {
    readonly read: <Value>(recoilValue: RecoilValue<Value>) => Value
    /** Reads a Valdres State directly, before this action's writes. */
    readonly readState: <Value>(state: State<Value>) => Value
    readonly writes: AtomWrites
}

export interface RecoilNode<Value> {
    readonly key: string
    /** Recoil's node type: atoms with a RecoilValue default are selectors. */
    readonly kind: "atom" | "selector"
    /** The Valdres State this node is read and subscribed through. */
    readonly state: State<Value>
    readonly write?: (context: WriteContext, value: unknown) => void
}

const nodes = new WeakMap<object, RecoilNode<any>>()

/** A read-only Recoil value handle. Keys label it; identity is the object. */
export class RecoilValueReadOnly<T> {
    declare readonly __tag: [T]
    readonly key: string

    constructor(key: string) {
        this.key = key
    }

    toJSON(): { key: string } {
        return { key: this.key }
    }
}

/** A writable Recoil value handle (an atom or a writable selector). */
export class RecoilState<T> extends RecoilValueReadOnly<T> {
    declare readonly __cTag: (t: T) => void
}

export type RecoilValue<T> = RecoilValueReadOnly<T> | RecoilState<T>

export const createRecoilValue = <Value>(
    node: RecoilNode<Value>,
): RecoilState<Value> | RecoilValueReadOnly<Value> => {
    const recoilValue =
        node.write === undefined
            ? new RecoilValueReadOnly<Value>(node.key)
            : new RecoilState<Value>(node.key)
    nodes.set(recoilValue, node)
    return recoilValue
}

const describe = (value: unknown) =>
    value === null
        ? "null"
        : typeof value === "object"
          ? (value.constructor?.name ?? "object")
          : typeof value

export const nodeOf = <Value>(
    recoilValue: RecoilValue<Value>,
    caller: string,
): RecoilNode<Value> => {
    const node = nodes.get(recoilValue as object)
    if (node === undefined)
        throw new Error(
            `Invalid argument to ${caller}: expected an atom or selector from @valdres-react/recoil but got ${describe(recoilValue)}`,
        )
    return node
}

export const isRecoilValueObject = (value: unknown): boolean =>
    typeof value === "object" && value !== null && nodes.has(value)
