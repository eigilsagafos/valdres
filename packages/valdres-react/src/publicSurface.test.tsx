import { describe, expect, test } from "bun:test"
import { atom, selector, store, type Store } from "valdres"
import * as publicApi from "./index"

type PublicApi = typeof import("./index")
type LegacyExport =
    | "InitializeCallback"
    | "Scope"
    | "StoreContext"
    | "useStoreId"
    | "useTransaction"
    | "useValdresCallback"

describe("public surface", () => {
    test("exports exactly the frozen React beta API", () => {
        expect(Object.keys(publicApi).sort()).toEqual([
            "Provider",
            "useAtom",
            "useResetAtom",
            "useSetAtom",
            "useStore",
            "useUpdateAtom",
            "useValue",
        ])

        const hasNoLegacyExports: Extract<
            keyof PublicApi,
            LegacyExport
        > extends never
            ? true
            : false = true
        expect(hasNoLegacyExports).toBe(true)
    })

    test("freezes the Atom-only and exact-value type contracts", () => {
        if (false) {
            const count = atom(0)
            const doubled = selector(get => get(count) * 2)
            const callbackAtom = atom<() => number>(() => 1)
            const selectedStore = store()

            const countValue: number = publicApi.useValue(count)
            const selectorValue: number = publicApi.useValue(doubled)
            const tuple: readonly [number, (value: number) => void] =
                publicApi.useAtom(count, selectedStore)
            const setCallback: (value: () => number) => void =
                publicApi.useSetAtom(callbackAtom, selectedStore)
            const updateCount: (update: (current: number) => number) => void =
                publicApi.useUpdateAtom(count, selectedStore)
            const resetCount: () => void = publicApi.useResetAtom(
                count,
                selectedStore,
            )

            void countValue
            void selectorValue
            void tuple
            void setCallback
            void updateCount
            void resetCount

            // @ts-expect-error useStore accepts no legacy string ID.
            publicApi.useStore("legacy-id")
            // @ts-expect-error write hooks accept Atom, not Selector.
            publicApi.useSetAtom(doubled)
            // @ts-expect-error write hooks accept Atom, not Selector.
            publicApi.useUpdateAtom(doubled)
            // @ts-expect-error write hooks accept Atom, not Selector.
            publicApi.useResetAtom(doubled)
            // @ts-expect-error Provider requires an owner-supplied Store.
            const missingStore = <publicApi.Provider />
            const initialize: Parameters<typeof publicApi.Provider>[0] = {
                store: selectedStore,
                // @ts-expect-error Provider no longer initializes Store ownership.
                initialize: () => undefined,
            }
            // @ts-expect-error useAtom returns a readonly tuple.
            tuple[0] = 2

            void missingStore
            void initialize
        }

        const storeTypeIsNameable: Store | undefined = undefined
        expect(storeTypeIsNameable).toBeUndefined()
    })
})
