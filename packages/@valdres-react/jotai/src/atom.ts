import {
    atom as valdresAtom,
    selector as valdresSelector,
    createStoreWithSelectorSet,
} from "valdres-react"
import {} from "valdres-react"

// @ts-ignore

// console.log(globalThis._valdresStore, createStoreWithSelectorSet("default"))
// console.log(globalThis._valdresStore.set.length)
// console.log(createStoreWithSelectorSet("default").set.length)
if (globalThis._valdresStore.kind !== "storeWithSelectorSet") {
    globalThis._valdresStore = createStoreWithSelectorSet("default")
}
if (!globalThis._valdresStore) {
    // @ts-ignore
    // globalThis._valdresStore = createStore("default")
}

const addSetToSelector = (selector, set) => {
    selector.set = (valdresSet, valdresGet, reset, ...args) => {
        return set(valdresGet, valdresSet, ...args)
    }
}

export const atom = (get, set) => {
    if (typeof get === "function" && get.length === 1) {
        const selector = valdresSelector(get)
        if (set) addSetToSelector(selector, set)
        return selector
    } else if (typeof set === "function") {
        if (get === null) get = () => undefined
        const selector = valdresSelector(get)
        if (set) addSetToSelector(selector, set)
        return selector
    } else {
        const newAtom = valdresAtom(get)
        // if (set) addSetToSelector(newAtom, set)
        return newAtom
    }
    // console.log(typeof get)
    // console.log(get)
    // console.log(get.length)
}
