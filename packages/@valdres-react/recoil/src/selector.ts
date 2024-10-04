import { selector as valdresSelector } from "valdres-react"
import {
    type GetRecoilValue,
    type ReadWriteSelectorOptions,
    type ReadOnlySelectorOptions,
} from "recoil"

// recoilSelector({ key: `sadfasdf`, get: ({ get }) => {}})

export const selector = <T>(
    options: ReadOnlySelectorOptions<T> | ReadWriteSelectorOptions<T>,
) => {
    const newSelector = valdresSelector(
        get =>
            options.get({
                get: get as GetRecoilValue,
                getCallback: () => {
                    throw new Error("Not implemnted")
                },
            }),
        {
            label: options.key,
        },
    )
    // @ts-ignore
    if (options.set) newSelector.set = options.set
    return newSelector
}
