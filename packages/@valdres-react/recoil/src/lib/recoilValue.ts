import type { Atom, State } from "valdres"
import { DefaultValue } from "../DefaultValue"

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
    readonly read: <Value>(recoilValue: ReadableValue<Value>) => Value
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

/** Internal: what the adapter reads, a Recoil value or a Valdres State. */
export type ReadableValue<T> = RecoilValue<T> | State<T>

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

const VALDRES_KINDS = new Set(["atom", "selector", "external", "collection-row", "collection"])

/**
 * A Valdres State, recognized by its public `kind` discriminant. A forged
 * object passes this check but is rejected by the Store on first use.
 */
export const isValdresState = (value: unknown): value is State<unknown> =>
    typeof value === "object" &&
    value !== null &&
    !nodes.has(value) &&
    VALDRES_KINDS.has((value as { kind?: unknown }).kind as string)

const valdresNodes = new WeakMap<object, RecoilNode<any>>()

/**
 * Valdres extension: a native State used where Recoil expects an atom or
 * selector. Only a Valdres Atom is writable; it keeps its own Valdres
 * semantics (its `equal`, and `reset` restoring its initial value).
 */
const valdresNode = (state: State<unknown>): RecoilNode<unknown> => {
    let node = valdresNodes.get(state)
    if (node === undefined) {
        const writable = state.kind === "atom"
        node = {
            key: `<valdres ${state.kind}>`,
            kind: writable ? "atom" : "selector",
            state,
            write: writable
                ? (context, value) =>
                      context.writes.set(
                          state as Atom<unknown>,
                          value instanceof DefaultValue ? RESET : value,
                      )
                : undefined,
        }
        valdresNodes.set(state, node)
    }
    return node
}

export const nodeOf = <Value>(
    recoilValue: ReadableValue<Value>,
    caller: string,
): RecoilNode<Value> => {
    const node = nodes.get(recoilValue as object)
    if (node !== undefined) return node
    if (isValdresState(recoilValue)) return valdresNode(recoilValue) as RecoilNode<Value>
    throw new Error(
        `Invalid argument to ${caller}: expected an atom or selector from @valdres-react/recoil, or a Valdres State, but got ${describe(recoilValue)}`,
    )
}

/** A Recoil atom or selector from this package. */
export const isRecoilValueObject = (value: unknown): boolean =>
    typeof value === "object" && value !== null && nodes.has(value)

/** Anything the adapter reads where Recoil reads a RecoilValue. */
export const isReadableValue = (value: unknown): boolean =>
    isRecoilValueObject(value) || isValdresState(value)
