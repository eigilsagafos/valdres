import { equal } from "./equal"
import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomOnInit } from "../types/AtomOnInit"
import type { GlobalAtomResetSelfFunc } from "../types/GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "../types/GlobalAtomSetSelfFunc"
import type { AtomOnSet } from "./../types/AtomOnSet"
import type { AtomOptions } from "./../types/AtomOptions"
import type { GlobalAtom } from "./../types/GlobalAtom"
import type { StoreData } from "./../types/StoreData"
import { isLive, mountAtom, unmountAtom } from "./mountAtom"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { installMaxAgeTimer } from "./subscribe"
import { globalStore } from "../globalStore"

export const globalAtom = <Value = unknown>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
) => {
    const stores = new Set<StoreData>()
    if (options.onSet)
        throw new Error("onSet on globalAtom is currently not supported")

    // Sync the atom's current value into a store on first access. Called by
    // initAtom whenever a store touches this atom for the first time.
    const onInit: AtomOnInit<Value> = (setSelf, data) => {
        setSelf(globalStore.get(atom))
        stores.add(data)
    }

    const onSet: AtomOnSet<Value> = (newValue, currentStore) => {
        if (stores.size > 1) {
            for (const store of stores) {
                if (store.id !== currentStore.id) {
                    setAtom(atom, newValue, store, true)
                }
            }
        }
    }

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

        let firstError: unknown
        const recordError = (e: unknown) => {
            if (!firstError) firstError = e
        }

        for (const s of snapshot) {
            try {
                unmountAtom(atom, s)
            } catch (e) {
                recordError(e)
            }
        }

        if (atom.maxAgeInterval) {
            atom.maxAgeInterval.cleanup()
            atom.maxAgeInterval.refCount = 0
            atom.maxAgeInterval = undefined
        }

        for (const store of snapshot) {
            stores.delete(store)
            store.values.delete(atom)
            try {
                propagateAtomUpdate([atom], store)
            } catch (e) {
                recordError(e)
            }
        }

        for (const s of subscribedStores) {
            stores.add(s)
            // Match subscribe.ts: maxAge timer is installed only when the
            // atom has a DIRECT subscriber. Transitive (selector-only)
            // subscribers go through the lazy-revalidation path on read.
            if (atom.maxAge && (s.subscriptions.get(atom)?.size ?? 0) > 0) {
                installMaxAgeTimer(atom, s)
            }
            try {
                mountAtom(atom, s)
            } catch (e) {
                recordError(e)
            }
        }

        if (firstError) throw firstError
    }

    const detach = (storeData: StoreData) => {
        stores.delete(storeData)
    }

    // `stores` is a plain data property. A getter wasn't buying anything —
    // the Set reference never changes, and accessor properties take a slower
    // IC path than data properties at every read site in subscribe.ts.
    const atom: GlobalAtom<Value> = {
        equal,
        ...options,
        defaultValue,
        onInit,
        onSet,
        onMount,
        setSelf,
        getSelf,
        resetSelf,
        detach,
        stores,
        maxAgeInterval: undefined,
    }
    return atom
}
