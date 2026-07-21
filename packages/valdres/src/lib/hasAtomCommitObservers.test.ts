import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"
import { getStoreData } from "./getStoreData"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"

describe("hasAtomCommitObservers", () => {
    for (const [kind, listen] of [
        [
            "onChange",
            (target: ReturnType<typeof store>) => target.onChange(() => {}),
        ],
        [
            "onCommitEnd",
            (target: ReturnType<typeof store>) => target.onCommitEnd(() => {}),
        ],
    ] as const) {
        test(`ignores an ${kind} listener on an unrelated store tree`, () => {
            const watched = store()
            const unrelated = store()
            const state = atom(0)
            const unsubscribe = listen(watched)
            try {
                expect(
                    hasAtomCommitObservers(state, getStoreData(unrelated)),
                ).toBe(false)
            } finally {
                unsubscribe()
                watched.dispose()
                unrelated.dispose()
            }
        })

        test(`detects an ${kind} listener on the affected store tree`, () => {
            const target = store()
            const state = atom(0)
            const unsubscribe = listen(target)
            try {
                expect(
                    hasAtomCommitObservers(state, getStoreData(target)),
                ).toBe(true)
            } finally {
                unsubscribe()
                target.dispose()
            }
        })
    }
})
