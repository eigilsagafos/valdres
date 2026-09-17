import { expect, test } from "bun:test"
import { externalAtom, selector } from "../../src/index"
import { createInspectableStore } from "../../src/inspect"
import { readHydrationSnapshot } from "../../src/adapter-internals/v1"

test("external inspection records lifecycle work and references without snapshot values", () => {
    let value = { secret: "external-private-snapshot" }
    let invalidate!: () => void
    const source = externalAtom(
        {
            getSnapshot: () => value,
            subscribe(callback) {
                invalidate = callback
                return () => {}
            },
        },
        { name: "source" },
    )
    const { store, inspect } = createInspectableStore()
    expect(inspect.capture(store, source).state).toMatchObject({
        kind: "external",
        name: "source",
    })
    inspect.span("pull", () => store.get(source))
    const stop = inspect.span("attach", () =>
        store.sub(source, () => store.get(source)),
    )
    inspect.span("change", () => {
        value = { secret: "replacement-private-snapshot" }
        invalidate()
    })
    inspect.span("detach", stop)
    const report = inspect.export()
    expect(report.fault).toBeUndefined()
    const spans = report.summaries.filter(event => event.type === "span")
    expect(spans.find(event => event.name === "pull")!.totals).toMatchObject({
        externalLiveSamples: 1,
        externalProjectionPublications: 1,
        externalAdapterSubscriptions: 0,
    })
    expect(spans.find(event => event.name === "attach")!.totals).toMatchObject({
        externalAdapterSubscriptions: 1,
        externalLifecycleRetains: 1,
    })
    expect(spans.find(event => event.name === "change")!.totals).toMatchObject({
        externalLiveSamples: 1,
        externalDirtyRounds: 1,
        externalDirtySamples: 1,
        subscriberCallbacks: 1,
    })
    expect(spans.find(event => event.name === "detach")!.totals).toMatchObject({
        externalAdapterCleanups: 1,
        externalLifecycleReleases: 1,
    })
    const events = report.details.filter(
        event => event.type === "external-source",
    )
    expect(events.map(event => event.action)).toEqual(
        expect.arrayContaining([
            "sample-live",
            "attach",
            "invalidate",
            "publish",
            "drain",
            "detach",
        ]),
    )
    expect(
        events.every(
            event =>
                event.state === undefined || event.state.kind === "external",
        ),
    ).toBe(true)
    expect(JSON.stringify(report)).not.toContain("private-snapshot")
    expect(events.every(Object.isFrozen)).toBe(true)
    store.dispose()
})

test("isolated server and transaction observations have counters and no lifecycle events", () => {
    const source = externalAtom({
        getSnapshot: () => 3,
        getServerSnapshot: () => 8,
        subscribe: () => () => {},
    })
    const selected = selector(get => get(source) * 2)
    const { store, inspect } = createInspectableStore()
    expect(
        inspect.span("server", () => readHydrationSnapshot(store, selected)),
    ).toBe(16)
    expect(
        inspect
            .export()
            .details.filter(event => event.type === "external-source"),
    ).toEqual([])
    const child = store.scope()
    inspect.span("transaction", () =>
        store.txn(tx => {
            expect(tx.get(source)).toBe(3)
            expect(tx.get(selected)).toBe(6)
            expect(tx.scope(child).get(source)).toBe(3)
        }),
    )
    const report = inspect.export()
    const spans = report.summaries.filter(event => event.type === "span")
    expect(spans.find(event => event.name === "server")!.totals).toMatchObject({
        externalServerSamples: 1,
        externalLiveSamples: 0,
        externalAdapterSubscriptions: 0,
        externalProjectionPublications: 0,
    })
    expect(
        spans.find(event => event.name === "transaction")!.totals,
    ).toMatchObject({
        externalServerSamples: 0,
        externalLiveSamples: 1,
        externalTransactionCaptures: 1,
        externalAdapterSubscriptions: 0,
        externalProjectionPublications: 0,
    })
    expect(report.fault).toBeUndefined()
    expect(
        report.details.filter(event => event.type === "external-source"),
    ).toEqual([])
    store.dispose()
})
