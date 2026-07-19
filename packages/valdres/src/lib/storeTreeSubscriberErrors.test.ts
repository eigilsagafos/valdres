import { expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"

test("settles child scopes before invoking a throwing root subscriber", () => {
    const root = store()
    const child = root.scope("child")
    const count = atom(10)
    const childCount = selector(get => get(count))
    const firstError = new Error("root subscriber failed")
    const observed: number[] = []

    const rootSubscriber = mock(() => {
        observed.push(child.get(childCount))
        throw firstError
    })
    const childSubscriber = mock(() => {
        observed.push(child.get(childCount))
    })

    root.sub(count, rootSubscriber)
    child.sub(childCount, childSubscriber)
    expect(child.get(childCount)).toBe(10)

    let thrown: unknown
    try {
        root.set(count, 20)
    } catch (error) {
        thrown = error
    }

    expect(thrown).toBe(firstError)
    expect(rootSubscriber).toHaveBeenCalledTimes(1)
    expect(childSubscriber).toHaveBeenCalledTimes(1)
    expect(observed).toEqual([20, 20])
    expect(child.get(childCount)).toBe(20)
})

test("settles child scopes before invoking a throwing root subscriber on delete", () => {
    const root = store()
    const child = root.scope("child")
    const entries = atomFamily<string>(undefined)
    const entry = entries("a")
    const childEntryCount = selector(get => get(entries).length)
    const firstError = new Error("root delete subscriber failed")
    const childSubscriber = mock(() => {})

    root.set(entry, "present")
    root.sub(entry, () => {
        throw firstError
    })
    child.sub(childEntryCount, childSubscriber)
    expect(child.get(childEntryCount)).toBe(1)

    let thrown: unknown
    try {
        root.del(entry)
    } catch (error) {
        thrown = error
    }

    expect(thrown).toBe(firstError)
    expect(childSubscriber).toHaveBeenCalledTimes(1)
    expect(child.get(childEntryCount)).toBe(0)
})

test("notifies child subscribers before child onChange listeners", () => {
    const root = store()
    const child = root.scope("child")
    const count = atom(10)
    const childCount = selector(get => get(count))
    const events: string[] = []

    child.sub(childCount, () => events.push("subscriber"))
    child.onChange(() => events.push("onChange"), { selectors: true })

    root.set(count, 20)

    expect(events).toEqual(["subscriber", "onChange"])
})
