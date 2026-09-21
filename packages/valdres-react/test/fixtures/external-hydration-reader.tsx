import { strict as assert } from "node:assert"
import { createRequire } from "node:module"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import {
    atom,
    externalAtom,
    selector,
    store,
    InvalidSynchronousExternalSnapshotError,
    StoreDisposedError,
    type State,
    type Store,
} from "valdres"
import { createInspectableStore } from "valdres/inspect"

GlobalRegistrator.register()

// This transparent hook observer is confined to this subprocess. It lets the
// test exercise the actual memoized third getter after a committed render.
const require = createRequire(import.meta.url)
const React = require("react") as typeof import("react")
const original = React.useSyncExternalStore
let currentReader: (() => unknown) | undefined
React.useSyncExternalStore = <Value,>(
    subscribe: (notify: () => void) => () => void,
    getSnapshot: () => Value,
    getServerSnapshot?: () => Value,
): Value => {
    currentReader = getServerSnapshot
    return original(subscribe, getSnapshot, getServerSnapshot)
}
const [{ renderHook }, ordinary, inspection] = await Promise.all([
    import("@testing-library/react"),
    import("../../src/useValue"),
    import("../../src/inspect"),
])
const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected an error")
}
const takeReader = () => {
    assert.equal(typeof currentReader, "function")
    return currentReader!
}
const report = []
for (const mode of ["ordinary", "inspect"] as const) {
    const core = mode === "inspect" ? createInspectableStore() : undefined
    const selected = core?.store ?? store()
    const read =
        core === undefined
            ? ordinary.useValue
            : inspection.createInspectableReact(core).useValue
    const child = selected.scope()
    const local = atom(0)
    selected.set(local, 1)
    child.set(local, 2)
    let firstServer = 20
    let firstReads = 0
    let secondReads = 0
    let attachments = 0
    let cleanups = 0
    const subscribe = () => {
        attachments++
        return () => {
            cleanups++
        }
    }
    const first = externalAtom({
        getSnapshot: () => 10,
        getServerSnapshot: () => {
            firstReads++
            return firstServer
        },
        subscribe,
    })
    const second = externalAtom({
        getSnapshot: () => 30,
        getServerSnapshot: () => {
            secondReads++
            return 30
        },
        subscribe,
    })
    const a = selector(get => get(local) + get(first))
    const b = selector(get => get(local) + get(second))
    const view = renderHook(
        ({ target, state }: { target: Store; state: State<number> }) =>
            read(state, target),
        {
            initialProps: { target: selected, state: a },
        },
    )
    const readerA = takeReader()
    assert.equal(firstReads, 0)
    const attachedBeforeServerRead = attachments
    assert.equal(readerA(), 21)
    firstServer = 90
    assert.equal(readerA(), 21)
    assert.equal(firstReads, 1)
    assert.equal(attachments, attachedBeforeServerRead)
    view.rerender({ target: selected, state: b })
    const readerB = takeReader()
    assert.notEqual(readerA, readerB)
    assert.equal(readerB(), 31)
    assert.equal(readerB(), 31)
    assert.equal(secondReads, 1)
    view.rerender({ target: child, state: b })
    const readerC = takeReader()
    assert.notEqual(readerB, readerC)
    assert.equal(readerC(), 32)
    assert.equal(readerC(), 32)
    assert.equal(secondReads, 2)
    child.dispose()
    assert.ok(thrownBy(readerC) instanceof StoreDisposedError)
    assert.equal(secondReads, 2)
    view.unmount()
    selected.dispose()
    assert.equal(cleanups, attachments)

    for (const kind of ["ordinary-error", "thenable"] as const) {
        const errorCore =
            mode === "inspect" ? createInspectableStore() : undefined
        const errorStore = errorCore?.store ?? store()
        const errorRead =
            errorCore === undefined
                ? ordinary.useValue
                : inspection.createInspectableReact(errorCore).useValue
        const expected = new Error("server failure")
        let serverReads = 0
        let contained = 0
        const thenable = {
            then() {
                contained++
            },
        }
        const state = externalAtom({
            getSnapshot: () => 1,
            getServerSnapshot: () => {
                serverReads++
                if (kind === "ordinary-error") throw expected
                return thenable as unknown as number
            },
            subscribe: () => () => undefined,
        })
        const errorView = renderHook(() => errorRead(state, errorStore))
        const reader = takeReader()
        const firstError = thrownBy(reader)
        assert.equal(thrownBy(reader), firstError)
        if (kind === "ordinary-error") assert.equal(firstError, expected)
        else
            assert.ok(
                firstError instanceof InvalidSynchronousExternalSnapshotError,
            )
        assert.equal(serverReads, 1)
        assert.equal(contained, kind === "thenable" ? 1 : 0)
        errorStore.dispose()
        assert.ok(thrownBy(reader) instanceof StoreDisposedError)
        assert.equal(serverReads, 1)
        errorView.unmount()
    }
    report.push({
        mode,
        cachedValue: true,
        stateRebind: true,
        storeRebind: true,
        cachedError: true,
        containedOnce: true,
        disposedWins: true,
    })
}
console.log("EXTERNAL_HYDRATION_RESULT:" + JSON.stringify(report))
