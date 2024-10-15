import { selector as valdresSelector } from "valdres-react"
import {
    type GetRecoilValue,
    type RecoilState,
    type ReadWriteSelectorOptions,
    type ReadOnlySelectorOptions,
} from "recoil"

// recoilSelector({ key: `sadfasdf`, get: ({ get }) => {}})

export const selector = <T>(
    options: ReadOnlySelectorOptions<T> | ReadWriteSelectorOptions<T>,
): RecoilState<T> => {
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
    if (options.set)
        // @ts-ignore
        newSelector.set = (set, get, reset, value) => {
            // @ts-ignore
            return options.set({ set, get, reset }, value)
        }
    return newSelector as unknown as RecoilState<T>
}
