import type { AtomOptions, RecoilState } from "recoil"
import { atom as valdresAtom } from "valdres"

export const atom = <T>(args: AtomOptions<T>): RecoilState<T> => {
    const options = {
        name: args.key,
    }

    if (args.effects?.length) {
        // @ts-ignore @ts-todo
        options.onMount = (store, atom) => {
            const onSetCallbacks: any[] = []
            // @ts-ignore @ts-todo
            for (const effect of args.effects) {
                effect({
                    node: atom,
                    storeID: store.data.id,
                    onSet: cb => {
                        onSetCallbacks.push(cb)
                    },
                    setSelf: val => {
                        store.set(atom, val)
                    },
                    trigger: "get",
                    getInfo_UNSTABLE: () => {
                        throw new Error("getInfo_UNSTABLE is not implemented")
                    },
                    resetSelf: () => {
                        store.reset(atom)
                    },
                    getPromise: () => {
                        throw new Error("getPromise is not implemented")
                    },
                    getLoadable: () => {
                        throw new Error("getLoadable is not implemented")
                    },
                })
            }
            let oldValue = store.get(atom)
            // @ts-ignore @ts-todo
            const unsubscribe = store.sub(atom, (...args) => {
                const newValue = store.get(atom)
                onSetCallbacks.forEach(cb => cb(newValue, oldValue, false))
                oldValue = newValue
            })
            return unsubscribe
        }
        // @ts-ignore @ts-todo
        options.onUnmount = unMount => {
            unMount()
        }
    }
    // In Recoil, `default: undefined` means "the value is literally undefined".
    // In valdres, `undefined` means "no default, use Suspense". We wrap
    // explicit `undefined` in a thunk so valdres treats it as a real value.
    const defaultValue =
        // @ts-ignore @ts-todo - AtomOptions is a union; `default` may not exist on all variants
        "default" in args && args.default === undefined
            ? () => undefined
            : (args as { default?: T }).default
    // @ts-ignore @ts-todo
    const newAtom = valdresAtom(defaultValue, options)

    return newAtom as unknown as RecoilState<T>
}
