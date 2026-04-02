import { atom as valdresAtom, selector as valdresSelector } from "valdres"

const addSetToSelector = (selector, set) => {
    selector.set = (valdresSet, valdresGet, reset, ...args) => {
        return set(valdresGet, valdresSet, ...args)
    }
}

export const atom = (get, set?: any) => {
    if (typeof get === "function" && get.length === 1) {
        const selector = valdresSelector(get, { equal: Object.is })
        if (set) addSetToSelector(selector, set)
        return selector
    } else if (typeof set === "function") {
        if (get === null) get = () => undefined
        const selector = valdresSelector(get, { equal: Object.is })
        if (set) addSetToSelector(selector, set)
        return selector
    } else {
        const newAtom = valdresAtom(get, { equal: Object.is })
        // if (set) addSetToSelector(newAtom, set)
        return newAtom
    }
}
