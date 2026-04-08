import {
    createStoreWithSelectorSet as valdresCreateStore,
    isPromiseLike,
    isSelector,
    Transaction,
} from "valdres"
import { registerStore } from "./storeRegistry"

export const createStore = (id?: string) => {
    const store = valdresCreateStore(id)

    // Register for setSelf lookup (selectors use data.id to find the store)
    registerStore(store.data.id, store)

    const data = store.data as any

    // --- Transaction-based write batching ---
    // Jotai defers all subscriber notifications until the entire write batch
    // completes. We use valdres transactions to collect atom changes and
    // propagate once at commit. Write-atom execution, onMount setSelf, and
    // unmount cleanup setSelf all go through this mechanism.
    let activeTxn: Transaction | null = null
    let isPropagating = false
    const deferredTxns: Transaction[] = []

    // Execute a write-atom's `set` function within a transaction.
    // The write fn receives (get, set) where set routes atom writes into the
    // active txn and get reads uncommitted values once writes have occurred.
    const executeWriteInTxn = (
        txn: Transaction,
        selector: any,
        args: any[],
    ) => {
        // Before any writes, get reads from the committed store cache
        // (preserving selector caching). After the first write, get switches
        // to the transaction so derived selectors see uncommitted values.
        let hasWrites = false
        const wrappedGet = (state: any) => {
            if (hasWrites) return txn.get(state)
            return rawGet(state)
        }
        const wrappedSet = (target: any, ...setArgs: any[]) => {
            hasWrites = true
            return store.set(target, ...setArgs)
        }
        return selector.set(wrappedSet, wrappedGet, store.reset, ...args)
    }

    // Commit deferred transactions that accumulated during propagation
    // (e.g. unmount cleanup calling setSelf triggers a new write-atom).
    const flushDeferred = () => {
        while (deferredTxns.length > 0) {
            const batch = [...deferredTxns]
            deferredTxns.length = 0
            isPropagating = true
            try {
                for (const txn of batch) {
                    txn.commit()
                }
            } finally {
                isPropagating = false
            }
        }
    }

    // Save the unwrapped get for React hooks — useValue uses store.get()
    // internally, and returning Promise.resolve() breaks useSyncExternalStore
    // (new Promise object each call → infinite re-render, plus Suspense throws
    // on any Promise value including resolved ones).
    const rawGet = store.get

    // Jotai's store.get() returns a Promise for async atoms even after
    // resolution. Valdres unwraps resolved values, so we re-wrap them.
    store.get = (state: any) => {
        const value = rawGet(state)
        if (state.__jotaiAsync && !isPromiseLike(value)) {
            return Promise.resolve(value)
        }
        return value
    }

    // For async atoms, suppress subscription notifications while the value
    // is still a Promise (i.e., during promise-to-promise transitions). Jotai
    // only notifies subscribers when the async atom settles to a resolved value.
    const originalSub = store.sub
    const jotaiWrappedSub = (
        state: any,
        callback: () => void,
        ...rest: any[]
    ) => {
        if (state.__jotaiAsync) {
            const wrappedCallback = () => {
                const value = rawGet(state)
                if (isPromiseLike(value)) return
                callback()
            }
            return originalSub(state, wrappedCallback, ...rest)
        }
        return originalSub(state, callback, ...rest)
    }

    // Wrap sub with a transaction so onMount setSelf calls defer
    // notifications until after the subscription setup completes.
    store.sub = (state: any, callback: () => void, ...rest: any[]) => {
        const txn = new Transaction(data)
        const prevTxn = activeTxn
        activeTxn = txn
        try {
            return jotaiWrappedSub(state, callback, ...rest)
        } finally {
            activeTxn = prevTxn
            txn.commit()
            flushDeferred()
        }
    }

    // Wrap set: write-atoms (selectors) execute within a transaction;
    // plain atom sets propagate directly but track propagation state
    // so nested sets from unmount cleanups are deferred.
    const originalSet = store.set
    store.set = (state: any, ...args: any[]) => {
        if (isSelector(state)) {
            if (activeTxn) {
                // Already inside a transaction — reuse it
                return executeWriteInTxn(activeTxn, state, args)
            }
            const txn = new Transaction(data)
            activeTxn = txn
            try {
                return executeWriteInTxn(txn, state, args)
            } finally {
                activeTxn = null
                if (!isPropagating) {
                    txn.commit()
                    flushDeferred()
                } else {
                    // Inside propagation (e.g. unmount cleanup) — defer commit
                    deferredTxns.push(txn)
                }
            }
        }
        // Plain atom set: propagation happens directly in core, but
        // unmount cleanups during propagation may call store.set on
        // selectors. Track propagation state so those are deferred.
        if (activeTxn) {
            // Inside a write-atom or sub txn — route to the txn
            return activeTxn.set(state, ...args)
        }
        const wasPropagating = isPropagating
        isPropagating = true
        try {
            return originalSet(state, ...args)
        } finally {
            if (!wasPropagating) {
                isPropagating = false
                flushDeferred()
            }
        }
    }

    // Expose rawGet so React hooks can bypass the Promise re-wrapping
    ;(store as any)._rawGet = rawGet

    // Note: jotai-style onMount `(setSelf) => cleanup` is converted to
    // valdres-style `(store, state) => cleanup` at atom creation time via
    // the onMount interceptor in atom.ts. No wrapping needed here.
    return store
}
