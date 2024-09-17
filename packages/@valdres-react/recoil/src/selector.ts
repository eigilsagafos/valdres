import { selector as valdresSelector } from "valdres-react"
import {
    // selector as recoilSelector,
    type ReadWriteSelectorOptions,
    type ReadOnlySelectorOptions,
} from "recoil"

// recoilSelector({ key: `sadfasdf`, get: ({ get }) => {}})

export const selector = <T>(
    options: ReadOnlySelectorOptions<T> | ReadWriteSelectorOptions<T>,
) => {
    const newSelector = valdresSelector(
        get => options.get({ get }),
        options.key,
    )
    if (options.set) newSelector.set = options.set
    return newSelector
}
