import type { AtomOptions } from "recoil"
import { atom as valdresAtom } from "valdres-react"

export const atom = <T>(args: AtomOptions<T>) => {
    const options = {
        label: args.key,
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
                onSetCallbacks.map(cb => cb(newValue, oldValue, false))
            })
            return unsubscribe
        }
        // @ts-ignore @ts-todo
        options.onUnmount = unMount => {
            unMount()
        }
    }
    // @ts-ignore @ts-todo
    const newAtom = valdresAtom(args.default, options)

    return newAtom
}
