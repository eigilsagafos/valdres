import type { Store } from "valdres"
import type { CallbackInterface } from "../types/CallbackInterface"
import type { TransactionInterface_UNSTABLE } from "../types/TransactionInterface_UNSTABLE"
import { readThrough, resetAction, setAction } from "./actions"
import { performNow, queueOrPerform, runBatched } from "./batch"
import { DEFAULT_VALUE } from "./defaultValue"
import {
    nodeOf,
    RESET,
    type AtomWrites,
    type RecoilValue,
} from "./recoilValue"
import { callbackSnapshot } from "./snapshot"
import { unsupported } from "./unsupported"

const CALLBACK_SHAPE =
    "useRecoilCallback() expects a function that returns a function: it accepts a function of the type (RecoilInterface) => (Args) => ReturnType and returns a callback function (Args) => ReturnType, where RecoilInterface is an object {snapshot, set, ...} and Args and ReturnType are the argument and return types of the callback you want to create.  Please see the docs at recoiljs.org for details."

const atomNode = (recoilValue: RecoilValue<any>, operation: string) => {
    const node = nodeOf(recoilValue, "transact_UNSTABLE")
    if (node.kind !== "atom")
        throw new Error(`${operation} selectors within atomicUpdate is not supported`)
    return node
}

/**
 * Recoil's atomic update: atom reads see this update's own writes, including
 * the `DefaultValue` a reset leaves until the update applies.
 */
const transact = (
    store: Store,
    update: (transaction: TransactionInterface_UNSTABLE) => void,
) =>
    performNow(store, {
        transact: (tx, beforeStaging) => {
            const changes = new Map<RecoilValue<any>, unknown>()
            const get = (recoilValue: RecoilValue<any>) => {
                if (changes.has(recoilValue)) return changes.get(recoilValue)
                atomNode(recoilValue, "Reading")
                return readThrough(tx, recoilValue, "transact_UNSTABLE")
            }
            const set = (recoilValue: RecoilValue<any>, valueOrUpdater: unknown) => {
                atomNode(recoilValue, "Setting")
                changes.set(
                    recoilValue,
                    typeof valueOrUpdater === "function"
                        ? valueOrUpdater(get(recoilValue))
                        : valueOrUpdater,
                )
            }
            update({
                get,
                set,
                reset: recoilValue => set(recoilValue, DEFAULT_VALUE),
            } as TransactionInterface_UNSTABLE)
            const writes: AtomWrites = new Map()
            for (const [recoilValue, value] of changes)
                nodeOf(recoilValue, "transact_UNSTABLE").write!(
                    {
                        read: value => readThrough(tx, value, "transact_UNSTABLE"),
                        readState: state => tx.get(state),
                        writes,
                    },
                    value,
                )
            beforeStaging()
            for (const [atom, value] of writes) {
                if (value === RESET) tx.reset(atom)
                else tx.set(atom, value)
            }
        },
    })

const refuse = (feature: string, detail: string) => () => unsupported(feature, detail)

/** Recoil's `recoilCallback`: one invocation of a useRecoilCallback callback. */
export const runCallback = <Args extends ReadonlyArray<unknown>, Return>(
    store: Store,
    factory: (callbackInterface: CallbackInterface) => (...args: Args) => Return,
    args: Args,
): Return =>
    runBatched(store, open => {
        if (typeof factory !== "function") throw new Error(CALLBACK_SHAPE)
        let snapshot: ReturnType<typeof callbackSnapshot> | undefined
        const callbackInterface = {
            set: (recoilValue: RecoilValue<any>, valueOrUpdater: unknown) =>
                queueOrPerform(store, setAction(recoilValue, valueOrUpdater)),
            reset: (recoilValue: RecoilValue<any>) =>
                queueOrPerform(store, resetAction(recoilValue)),
            refresh: refuse(
                "refresh",
                "Valdres selectors recompute when their inputs change and cannot be re-run on demand; model the refresh as an atom the selector reads.",
            ),
            gotoSnapshot: refuse(
                "gotoSnapshot",
                "A Valdres Store has no snapshots to restore; write the values back with set.",
            ),
            transact_UNSTABLE: (update: (transaction: TransactionInterface_UNSTABLE) => void) =>
                transact(store, update),
            // Taken on first access, as Recoil's lazy snapshot is.
            get snapshot() {
                snapshot ??= callbackSnapshot(open)
                return snapshot
            },
        }
        const callback = factory(callbackInterface as unknown as CallbackInterface)
        if (typeof callback !== "function") throw new Error(CALLBACK_SHAPE)
        return callback(...args)
    })
