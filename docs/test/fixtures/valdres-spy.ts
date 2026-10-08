// Test-only stand-in for `valdres` in the todo and family demos (see
// demo-behavior.ts). It re-exports the real runtime and wraps `store()` to
// count subscriptions and Stores and to record any Store call made from inside
// a notification callback.
export * from "../../../packages/valdres/src/index.ts"
import { store as realStore } from "../../../packages/valdres/src/index.ts"

export const spy = {
    stores: 0,
    disposed: 0,
    subscriptions: 0,
    liveSubscriptions: 0,
    notifications: 0,
    inNotification: false,
    notificationCalls: [] as string[],
}

export const store: typeof realStore = () => {
    const real = realStore()
    spy.stores++
    let disposed = false
    const live = new Set<() => void>()
    const guarded =
        <Args extends unknown[], Result>(name: string, fn: (...args: Args) => Result) =>
        (...args: Args): Result => {
            if (spy.inNotification) spy.notificationCalls.push(name)
            return fn(...args)
        }
    return {
        get: (state: any) => real.get(state),
        set: guarded("set", (state: any, value: any) => real.set(state, value)),
        update: guarded("update", (state: any, updater: any) => real.update(state, updater)),
        reset: guarded("reset", (state: any) => real.reset(state)),
        delete: guarded("delete", (row: any) => real.delete(row)),
        txn: guarded("txn", (fn: any) => real.txn(fn)),
        scope: guarded("scope", (name?: any) => real.scope(name)),
        sub: guarded("sub", (state: any, callback: any) => {
            spy.subscriptions++
            spy.liveSubscriptions++
            const unsubscribe = real.sub(state, () => {
                spy.notifications++
                spy.inNotification = true
                try {
                    callback()
                } finally {
                    spy.inNotification = false
                }
            })
            const tracked = () => {
                if (live.delete(tracked)) spy.liveSubscriptions--
                unsubscribe()
            }
            live.add(tracked)
            return tracked
        }),
        dispose: guarded("dispose", () => {
            if (!disposed) {
                disposed = true
                spy.disposed++
                spy.liveSubscriptions -= live.size
                live.clear()
            }
            real.dispose()
        }),
    } as unknown as ReturnType<typeof realStore>
}
