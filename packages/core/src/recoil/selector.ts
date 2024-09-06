import { selector as baseSelector } from "../selector"
import {
    selector as recoilSelector,
    type ReadWriteSelectorOptions,
    type ReadOnlySelectorOptions,
} from "recoil"

// recoilSelector({ key: `sadfasdf`, get: ({ get }) => {}})

export const selector = <T>(
    options: ReadOnlySelectorOptions<T> | ReadWriteSelectorOptions<T>
) => {
    const valdresSelector = baseSelector(
        get => options.get({ get }),
        options.key
    )
    if (options.set) valdresSelector.set = options.set
    return valdresSelector
}
