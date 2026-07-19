import { test } from "bun:test"
import { selectorFamily } from "../selectorFamily"
import { store } from "../store"

test("selector-family objects are factories, not readable or subscribable state", () => {
    const family = selectorFamily((id: string) => () => id)
    const rootStore = store()

    if (false) {
        // @ts-expect-error selector-family objects cannot be read as state
        rootStore.get(family)
        // @ts-expect-error subscribe to a selector-family member instead
        rootStore.sub(family, () => {})
    }
})
