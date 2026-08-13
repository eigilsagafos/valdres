import { describe, expect, test } from "bun:test"
import { store } from "../store"

const invalidStates: [description: string, state: object][] = [
    [
        "a throwing name accessor",
        Object.defineProperty({}, "name", {
            get() {
                throw new Error("name accessor should not escape")
            },
        }),
    ],
    [
        "a throwing name proxy trap",
        new Proxy(
            {},
            {
                get(target, property, receiver) {
                    if (property === "name") {
                        throw new Error("name proxy trap should not escape")
                    }
                    return Reflect.get(target, property, receiver)
                },
            },
        ),
    ],
]

describe("state names in public API errors", () => {
    test.each(invalidStates)("ignores %s", (_, state) => {
        const rootStore = store()

        expect(() => rootStore.get(state as any)).toThrow(
            "valdres: invalid object passed to get()",
        )
        expect(() => rootStore.sub(state as any, () => {})).toThrow(
            "valdres: invalid object passed to sub()",
        )
        expect(() => rootStore.set(state as any, undefined)).toThrow(
            "valdres: invalid state object passed to set()",
        )
    })
})
