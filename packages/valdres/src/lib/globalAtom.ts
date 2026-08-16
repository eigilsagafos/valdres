import { equal } from "./equal"
import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomOnInit } from "../types/AtomOnInit"
import type { CommitForestEntry } from "../types/CommitForestSettleFn"
import type { GlobalAtomResetSelfFunc } from "../types/GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "../types/GlobalAtomSetSelfFunc"
import type { AtomOnSet } from "./../types/AtomOnSet"
import type { AtomOptions } from "./../types/AtomOptions"
import type { InternalGlobalAtom } from "./../types/InternalGlobalAtom"
import type { StoreData } from "./../types/StoreData"
import { cacheController } from "./cacheController"
import { runCommitPlan } from "./commitEngine"
import { createCommitErrors, recordCommitError } from "./commitErrors"
import {
    createCommitPlan,
    forestEntry,
    forestSettlement,
    NO_ON_SETS,
} from "./commitPlans"
import { globalOnSetMarker } from "./globalOnSetMarker"
import { isLive, mountAtom, unmountAtom } from "./graph"
import { settleCommitForest } from "./propagateUpdatedAtoms"
import { subscribe } from "./subscribe"
import { detachOwnValue } from "./unsetValue"
import { globalStore } from "../globalStore"
import {
    isStoreDisposed,
    trackTouchedGlobal,
    untrackTouchedGlobal,
} from "./storeLifecycle"
import { getStoreData } from "./getStoreData"

export const globalAtom = <Value = unknown>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
) => {
    const stores = new Set<StoreData>()
    const globalStoreData = getStoreData(globalStore)
    const userOnSet = options.onSet

    const attach = (data: StoreData) => {
        // User cleanup runs during disposal and may still hold a store facade.
        // A terminal store must never acquire a new strong registration.
        // globalStore is permanent. Reverse-tracking it would make that store
        // retain every otherwise-unreferenced global atom forever.
        if (data === globalStoreData) {
            if (isStoreDisposed(data)) return
        } else if (!trackTouchedGlobal(data, atom)) {
            return
        }
        stores.add(data)
    }

    const detach = (data: StoreData) => {
        stores.delete(data)
        untrackTouchedGlobal(data, atom)
    }

    // Sync the atom's current value into a store on first access. Called by
    // initAtom whenever a store touches this atom for the first time.
    const onInit: AtomOnInit<Value> = (setSelf, data) => {
        setSelf(globalStore.get(atom))
        attach(data)
    }

    // Cross-store synchronization is part of the write phase (see
    // globalAtomFanOut), rather than this hook. The no-op fallback marks a
    // global atom as commit-sensitive without adding another property check to
    // every ordinary set.
    const onSet: AtomOnSet<Value> = userOnSet ?? globalOnSetMarker

    // For global atoms, options.onMount fires when the FIRST subscriber across
    // any store attaches, and its cleanup fires when the LAST subscriber across
    // all stores detaches. mountAtom invokes the wrapper per-store; we collapse
    // those into a single global lifecycle via a ref counter. The first store
    // to mount is the one whose (store, state) gets forwarded to userOnMount.
    let mountCount = 0
    let userCleanup: (() => void) | void
    const userOnMount = options.onMount as
        | ((...args: unknown[]) => void | (() => void))
        | undefined
    const onMount = userOnMount
        ? (...args: unknown[]) => {
              mountCount++
              if (mountCount === 1) {
                  try {
                      userCleanup = userOnMount(...args)
                  } catch (error) {
                      // Roll back so a future mount retries userOnMount
                      // instead of seeing a stuck non-zero counter.
                      mountCount--
                      userCleanup = undefined
                      throw error
                  }
              }
              return () => {
                  if (mountCount <= 0) return
                  mountCount--
                  if (mountCount === 0 && typeof userCleanup === "function") {
                      const cleanup = userCleanup
                      userCleanup = undefined
                      cleanup()
                  }
              }
          }
        : undefined

    const getSelf = () => globalStore.get(atom)

    const setSelf: GlobalAtomSetSelfFunc<Value> = newValue =>
        globalStore.set(atom, newValue)

    const resetSelf: GlobalAtomResetSelfFunc = () => {
        // Snapshot stores that still have active subscribers so we can
        // remount cleanly after the value is cleared. Reset is a "full
        // restart" — cleanup current listeners, clear value, then re-arm
        // listeners for stores that still want updates. Errors from any
        // single store don't short-circuit the rest; the first one is
        // rethrown after the reset finishes.
        const snapshot = [...stores]
        const subscribedStores: StoreData[] = []
        for (const s of snapshot) {
            // Use transitive subscription so selector subscribers (which
            // mount the atom via mountTransitiveDeps) keep their listeners
            // alive across resetSelf.
            if (isLive(atom, s)) {
                subscribedStores.push(s)
            }
        }

        const errors = createCommitErrors()

        for (const s of snapshot) {
            try {
                unmountAtom(atom, s)
            } catch (e) {
                recordCommitError(errors, e)
            }
        }

        if (atom.cacheController) {
            try {
                cacheController.stopGlobal(atom)
            } catch (e) {
                recordCommitError(errors, e)
            }
        }

        const entries: CommitForestEntry[] = []
        for (const store of snapshot) {
            detach(store)
            detachOwnValue(atom, store)
            entries.push(
                forestEntry(store, [atom], undefined, undefined, undefined),
            )
        }

        const origin = subscribedStores[0] ?? snapshot[0] ?? globalStoreData
        runCommitPlan(
            createCommitPlan(
                origin,
                forestSettlement(
                    origin,
                    entries,
                    undefined,
                    settleCommitForest,
                ),
                NO_ON_SETS,
                errors,
                "reset",
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                () => {
                    for (const s of subscribedStores) {
                        try {
                            attach(s)
                        } catch (e) {
                            recordCommitError(errors, e)
                        }
                        // Match subscribe.ts: cache policy is retained only when
                        // the atom has a DIRECT subscriber. Transitive
                        // (selector-only) subscribers revalidate lazily on read.
                        if (
                            atom.maxAge !== undefined &&
                            (s.subscriptions.get(atom)?.size ?? 0) > 0
                        ) {
                            try {
                                cacheController.retain(atom, s, subscribe)
                            } catch (e) {
                                recordCommitError(errors, e)
                            }
                        }
                        try {
                            mountAtom(atom, s)
                        } catch (e) {
                            recordCommitError(errors, e)
                        }
                    }
                },
            ),
        )
    }

    // `stores` is a plain data property. A getter wasn't buying anything —
    // the Set reference never changes, and accessor properties take a slower
    // IC path than data properties at every read site in subscribe.ts.
    const atom: InternalGlobalAtom<Value> = {
        equal,
        ...options,
        defaultValue,
        onInit,
        onSet,
        onMount,
        setSelf,
        getSelf,
        resetSelf,
        attach,
        detach,
        stores,
        cacheController: undefined,
    }
    return atom
}
