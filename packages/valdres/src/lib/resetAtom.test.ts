import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { SchemaValidationError } from "../errors/SchemaValidationError"
import { StoreDisposedError } from "../errors/StoreDisposedError"
import { globalAtom } from "../globalAtom"
import { selector } from "../selector"
import { store } from "../store"
import { uniqueName } from "../../test/utils/uniqueName"

describe("direct reset commit pipeline", () => {
    test("selector defaults initialize and commit without a post-commit throw", () => {
        const useSecond = atom(false)
        const first = atom(1)
        const second = atom(2)
        const selectedDefault = selector(get =>
            get(useSecond) ? get(second) : get(first),
        )
        const value = atom(selectedDefault)
        const store1 = store()

        store1.set(value, 10)
        store1.set(useSecond, true)

        expect(() => store1.reset(value)).not.toThrow()
        expect(store1.get(value)).toBe(2)
    })

    test("a Promise reset notifies subscribers of the pending state", async () => {
        let resolve!: (value: number) => void
        const pending = new Promise<number>(done => {
            resolve = done
        })
        const value = atom(() => pending)
        const store1 = store()

        store1.set(value, 2)
        const subscriber = mock(() => {})
        const unsubscribe = store1.sub(value, subscriber)

        expect(store1.reset(value)).toBe(pending)
        expect(store1.get(value)).toBe(pending)
        expect(subscriber).toHaveBeenCalledTimes(1)

        unsubscribe()
        resolve(1)
        await pending
        await Promise.resolve()
    })

    test("runs onSet and finishes propagation before rethrowing its error", () => {
        const hookError = new Error("reset onSet failed")
        let throwFromHook = false
        const onSet = mock((value: number) => {
            if (throwFromHook) throw hookError
        })
        const value = atom(1, { onSet })
        const doubled = selector(get => get(value) * 2)
        const store1 = store()

        store1.set(value, 2)
        const seen: number[] = []
        store1.sub(doubled, () => seen.push(store1.get(doubled)))
        throwFromHook = true

        let thrown: unknown
        try {
            store1.reset(value)
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBe(hookError)
        expect(onSet).toHaveBeenLastCalledWith(1, store1)
        expect(store1.get(value)).toBe(1)
        expect(store1.get(doubled)).toBe(2)
        expect(seen).toEqual([2])
    })

    test("fans a global reset out to every initialized peer store", () => {
        const value = globalAtom(1, { name: uniqueName("value") })
        const source = store()
        const peer = store()
        const sourceSubscriber = mock(() => {})
        const peerSubscriber = mock(() => {})

        const unsubscribeSource = source.sub(value, sourceSubscriber)
        const unsubscribePeer = peer.sub(value, peerSubscriber)
        source.set(value, 2)
        sourceSubscriber.mockClear()
        peerSubscriber.mockClear()

        source.reset(value)

        expect(source.get(value)).toBe(1)
        expect(peer.get(value)).toBe(1)
        expect(sourceSubscriber).toHaveBeenCalledTimes(1)
        expect(peerSubscriber).toHaveBeenCalledTimes(1)

        unsubscribeSource()
        unsubscribePeer()
        source.dispose()
        peer.dispose()
    })

    test("validates the default before replacing the committed value", () => {
        let defaultValue: unknown = 1
        const value = atom(() => defaultValue as number, {
            schemaValidation: true,
            schema: {
                parse(candidate) {
                    if (typeof candidate !== "number") {
                        throw new Error("expected number")
                    }
                    return candidate
                },
            },
        })
        const store1 = store()

        store1.set(value, 2)
        defaultValue = "invalid"

        expect(() => store1.reset(value)).toThrow(SchemaValidationError)
        expect(store1.get(value)).toBe(2)
    })

    test("disposal from a default keeps the reset terminal and skips its write", () => {
        const store1 = store()
        let disposeDuringDefault = false
        const value = atom(() => {
            if (disposeDuringDefault) store1.dispose()
            return 1
        })

        expect(store1.get(value)).toBe(1)
        store1.set(value, 2)
        disposeDuringDefault = true

        expect(() => store1.reset(value)).toThrow(StoreDisposedError)
    })
})
