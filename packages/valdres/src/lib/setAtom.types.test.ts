import { atom } from "../atom"
import { store } from "../store"

type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

const root = store()
const count = atom(0)

const syncValue = root.set(count, 1)
const syncUpdater = root.set(count, current => current + 1)
const asyncValue = root.set(count, Promise.resolve(1))
const asyncUpdater = root.set(count, current => Promise.resolve(current + 1))

type _SyncValue = Expect<Equal<typeof syncValue, number>>
type _SyncUpdater = Expect<Equal<typeof syncUpdater, number>>
type _AsyncValue = Expect<Equal<typeof asyncValue, Promise<number>>>
type _AsyncUpdater = Expect<Equal<typeof asyncUpdater, Promise<number>>>

if (false) {
    // @ts-expect-error an async write returns its promise, not the atom's value
    const n: number = root.set(count, Promise.resolve(1))
    void n
}

root.txn(txn => {
    const syncValue = txn.set(count, 1)
    const syncUpdater = txn.set(count, current => current + 1)
    const asyncValue = txn.set(count, Promise.resolve(1))
    const asyncUpdater = txn.set(count, current => Promise.resolve(current + 1))

    type _SyncValue = Expect<Equal<typeof syncValue, number>>
    type _SyncUpdater = Expect<Equal<typeof syncUpdater, number>>
    type _AsyncValue = Expect<Equal<typeof asyncValue, Promise<number>>>
    type _AsyncUpdater = Expect<Equal<typeof asyncUpdater, Promise<number>>>

    if (false) {
        // @ts-expect-error an async transaction write returns its promise
        const n: number = txn.set(count, Promise.resolve(1))
        void n
    }
})
