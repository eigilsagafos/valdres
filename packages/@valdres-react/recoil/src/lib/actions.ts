import type { Transaction } from "valdres"
import { DEFAULT_VALUE } from "./defaultValue"
import {
    nodeOf,
    RESET,
    type AtomWrites,
    type RecoilValue,
    type WriteContext,
} from "./recoilValue"
import { unwrapError } from "./unwrapError"

/** One queued Recoil write, as Recoil's `set` action. */
export type Action =
    | {
          readonly recoilValue: RecoilValue<any>
          readonly valueOrUpdater: unknown
      }
    | {
          readonly transact: (
              tx: Transaction,
              beforeStaging: () => void,
          ) => void
      }

/** Reads through a transaction, surfacing what a failing getter threw. */
export const readThrough = <Value>(
    tx: Pick<Transaction, "get">,
    recoilValue: RecoilValue<Value>,
    caller: string,
): Value => {
    const { state } = nodeOf(recoilValue, caller)
    try {
        return tx.get(state)
    } catch (error) {
        throw unwrapError(error)
    }
}

/**
 * Resolves a Recoil write into atom writes. As in Recoil, an updater runs
 * first, against the state before this action, and then a read-only target
 * throws.
 */
export const resolveWrite = (
    context: WriteContext,
    recoilValue: RecoilValue<any>,
    valueOrUpdater: unknown,
    caller: string,
) => {
    const node = nodeOf(recoilValue, caller)
    const value =
        typeof valueOrUpdater === "function"
            ? valueOrUpdater(context.read(recoilValue))
            : valueOrUpdater
    if (node.write === undefined)
        throw new Error(`Attempt to set read-only RecoilValue: ${node.key}`)
    node.write(context, value)
}

/**
 * Stages one action's atom writes; later actions read them. `beforeStaging`
 * runs once everything is resolved, just before the first write is staged.
 */
export const applyAction = (
    tx: Transaction,
    action: Action,
    beforeStaging: () => void = () => {},
) => {
    if ("transact" in action) {
        action.transact(tx, beforeStaging)
        return
    }
    const writes: AtomWrites = new Map()
    resolveWrite(
        {
            read: value => readThrough(tx, value, "set"),
            readState: state => tx.get(state),
            writes,
        },
        action.recoilValue,
        action.valueOrUpdater,
        "set",
    )
    beforeStaging()
    for (const [atom, value] of writes) {
        if (value === RESET) tx.reset(atom)
        else tx.set(atom, value)
    }
}

export const setAction = (
    recoilValue: RecoilValue<any>,
    valueOrUpdater: unknown,
): Action => ({ recoilValue, valueOrUpdater })

export const resetAction = (recoilValue: RecoilValue<any>): Action => ({
    recoilValue,
    valueOrUpdater: DEFAULT_VALUE,
})
