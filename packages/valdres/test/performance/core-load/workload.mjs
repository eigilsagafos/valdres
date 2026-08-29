import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"
import { assertSynchronousCounterReset } from "./lib.mjs"

export async function runCoreLoadWorkload({
    adapter,
    fixture,
    scenarioName,
    mode,
}) {
    const scenario = fixture.scenarios[scenarioName]
    if (scenario === undefined) {
        throw new Error(`unknown scenario ${scenarioName}`)
    }
    if (!new Set(["timed", "oracle", "counters"]).has(mode)) {
        throw new Error(`unknown workload mode ${mode}`)
    }

    const trace = createTrace(fixture, scenarioName, mode === "oracle")
    const work = {
        renderReads: 0,
        notificationReads: 0,
        notifications: 0,
        subscriptions: 0,
        timedUnsubscriptions: 0,
        totalUnsubscriptions: 0,
        entityWrites: 0,
        metaWrites: 0,
    }

    const graph = constructGraph(adapter, fixture.inputs)
    const resetResult = adapter.resetWorkCounters()
    assertSynchronousCounterReset(resetResult, "benchmark counter adapter")
    const initialInternalWork = cloneCounters(adapter.snapshotWorkCounters())
    if (mode === "timed" && adapter.instrumented) {
        throw new Error(
            "counter-instrumented artifacts cannot supply timing samples",
        )
    }

    const rows = graph.views.map((itemViews, itemIndex) => {
        let unsubscriptions = []
        return {
            get mounted() {
                return unsubscriptions.length > 0
            },
            render() {
                for (
                    let subscriber = 0;
                    subscriber < itemViews.length;
                    subscriber++
                ) {
                    const value = adapter.get(
                        graph.scope,
                        itemViews[subscriber],
                    )
                    work.renderReads++
                    trace.read(itemIndex, subscriber, value)
                }
            },
            commit() {
                for (
                    let subscriber = 0;
                    subscriber < itemViews.length;
                    subscriber++
                ) {
                    const state = itemViews[subscriber]
                    const unsubscribe = adapter.subscribe(
                        graph.scope,
                        state,
                        () => {
                            work.notifications++
                            trace.notification(itemIndex, subscriber)
                            const value = adapter.get(graph.scope, state)
                            work.notificationReads++
                            trace.read(itemIndex, subscriber, value)
                        },
                    )
                    if (typeof unsubscribe !== "function") {
                        throw new Error(
                            "subscribe must return a synchronous cleanup function",
                        )
                    }
                    work.subscriptions++
                    unsubscriptions.push(unsubscribe)
                }
            },
            unmount(inTimedWindow) {
                for (const unsubscribe of unsubscriptions) {
                    unsubscribe()
                    work.totalUnsubscriptions++
                    if (inTimedWindow) work.timedUnsubscriptions++
                }
                unsubscriptions = []
            },
        }
    })

    const start = mode === "timed" ? performance.now() : null
    for (let index = 0; index < fixture.inputs.window; index++) {
        rows[index].render()
    }
    for (let index = 0; index < fixture.inputs.window; index++) {
        rows[index].commit()
    }

    let top = 0
    for (let step = 0; step < fixture.inputs.steps; step++) {
        if (scenario.writesEnabled) {
            const hot =
                (top + (step % fixture.inputs.window)) % fixture.inputs.items
            adapter.update(graph.scope, graph.entities[hot], previous => ({
                ...previous,
                id: previous.id,
                duration: step,
                cost: step * 2,
            }))
            work.entityWrites++
            if (step % fixture.inputs.metaWriteEvery === 0) {
                adapter.set(graph.scope, graph.meta, { n: step })
                work.metaWrites++
            }
        }

        const leaving = []
        const entering = []
        for (let offset = 0; offset < fixture.inputs.scroll; offset++) {
            leaving.push(rows[(top + offset) % fixture.inputs.items])
            entering.push(
                rows[
                    (top + fixture.inputs.window + offset) %
                        fixture.inputs.items
                ],
            )
        }
        for (const row of leaving) row.unmount(true)
        for (const row of entering) row.render()
        for (const row of entering) row.commit()
        top = (top + fixture.inputs.scroll) % fixture.inputs.items
    }
    const elapsedMs = start === null ? null : performance.now() - start
    const internalWorkAtTimerEnd = cloneCounters(adapter.snapshotWorkCounters())

    const selectedFinalValues =
        mode === "oracle"
            ? readSelectedFinalValues(
                  adapter,
                  graph,
                  fixture.inputs,
                  top,
                  trace,
              )
            : null

    for (const row of rows) row.unmount(false)
    const internalWorkAfterUnmount = cloneCounters(
        adapter.snapshotWorkCounters(),
    )
    const notificationsBeforeDrain = work.notifications
    await Promise.resolve()
    await new Promise(resolve => setImmediate(resolve))
    const internalWorkAfterDrain = cloneCounters(adapter.snapshotWorkCounters())

    adapter.dispose(graph.root)
    const internalWorkAfterDispose = cloneCounters(
        adapter.snapshotWorkCounters(),
    )
    await Promise.resolve()
    await new Promise(resolve => setImmediate(resolve))
    const internalWorkAfterDisposeDrain = cloneCounters(
        adapter.snapshotWorkCounters(),
    )

    if (
        mode === "timed" &&
        internalWorkAfterDisposeDrain.kind !== "unavailable"
    ) {
        throw new Error(
            "counter-instrumented artifacts cannot supply timing samples",
        )
    }

    return {
        mode,
        scenario: scenarioName,
        elapsedMs,
        semanticChecksum: trace.semanticChecksum(),
        oracleTraceSha256: trace.oracleTraceSha256(),
        selectedFinalValues,
        counterReset: { synchronous: true, thenable: false },
        work,
        internalWork: {
            initial: initialInternalWork,
            atTimerEnd: internalWorkAtTimerEnd,
            afterUnmount: internalWorkAfterUnmount,
            afterDrain: internalWorkAfterDrain,
            afterDispose: internalWorkAfterDispose,
            afterDisposeDrain: internalWorkAfterDisposeDrain,
        },
        postDrain: {
            notificationsAdded: work.notifications - notificationsBeforeDrain,
        },
    }
}

function constructGraph(adapter, inputs) {
    const root = adapter.createStore()
    const scope = adapter.createScope(root, "process")
    const meta = adapter.createAtom({ n: 0 }, "meta")
    const entities = Array.from({ length: inputs.items }, (_, index) =>
        adapter.createAtom(
            {
                id: index,
                duration: undefined,
                cost: undefined,
            },
            `e/${index}`,
        ),
    )

    const shared = Array.from({ length: inputs.shared }, (_, sharedIndex) =>
        adapter.createSelector(get => {
            let count = 0
            for (const entity of entities) {
                count += get(entity).id >= 0 ? 1 : 0
            }
            return count + sharedIndex + (get(meta).n & 0)
        }, `sh/${sharedIndex}`),
    )

    const leaves = entities.flatMap((entity, itemIndex) =>
        Array.from({ length: inputs.leaves }, (_, leafIndex) =>
            adapter.createSelector(get => {
                const value = get(entity)
                if (leafIndex === 0) return value.duration
                if (leafIndex === 1) return value.cost
                return value.id
            }, `lf/${itemIndex}/${leafIndex}`),
        ),
    )

    const chains = entities.map((entity, itemIndex) => {
        let previous = adapter.createSelector(get => {
            let value = get(entity).id
            for (let leafIndex = 0; leafIndex < inputs.leaves; leafIndex++) {
                value += Number(
                    get(leaves[itemIndex * inputs.leaves + leafIndex]) ?? 0,
                )
            }
            return value
        }, `c/${itemIndex}/0`)

        for (let depth = 1; depth < inputs.depth; depth++) {
            const dependency = previous
            const sharedState = shared[depth % inputs.shared]
            previous = adapter.createSelector(
                get => get(dependency) + (get(sharedState) % 7),
                `c/${itemIndex}/${depth}`,
            )
        }
        return previous
    })

    const views = entities.map((_, itemIndex) =>
        Array.from(
            { length: inputs.subscribersPerItem },
            (_, subscriberIndex) =>
                adapter.createSelector(
                    get =>
                        get(chains[itemIndex]) +
                        (get(shared[subscriberIndex % inputs.shared]) % 3) +
                        Number(
                            get(
                                leaves[
                                    itemIndex * inputs.leaves +
                                        (subscriberIndex % inputs.leaves)
                                ],
                            ) ?? 0,
                        ),
                    `view/${itemIndex}/${subscriberIndex}`,
                ),
        ),
    )

    return { root, scope, meta, entities, views }
}

function readSelectedFinalValues(adapter, graph, inputs, top, trace) {
    const activeItems = [
        top,
        (top + Math.floor(inputs.window / 2)) % inputs.items,
        (top + inputs.window - 1) % inputs.items,
    ]
    const entityItems = [0, Math.floor(inputs.items / 2), inputs.items - 1]
    const result = {
        top,
        meta: adapter.get(graph.scope, graph.meta),
        entities: entityItems.map(item => ({
            item,
            value: adapter.get(graph.scope, graph.entities[item]),
        })),
        activeViews: activeItems.map(item => ({
            item,
            subscriber: 0,
            value: adapter.get(graph.scope, graph.views[item][0]),
        })),
    }
    trace.final(result)
    return result
}

function createTrace(fixture, scenarioName, oracle) {
    let checksum = fixture.checksumSeed >>> 0
    const oracleHash = oracle ? createHash("sha256") : null
    oracleHash?.update(
        `fixture|${fixture.id}|${scenarioName}|${fixture.checksumSeed}|${canonicalValue(fixture.inputs)}\n`,
    )

    const mix = value => {
        checksum ^= value >>> 0
        checksum = Math.imul(checksum, 0x01000193) >>> 0
    }
    const mixInteger = value => {
        if (!Number.isSafeInteger(value)) {
            throw new Error(
                `fixture produced a non-integer public value: ${String(value)}`,
            )
        }
        const absolute = Math.abs(value)
        mix(value < 0 ? 1 : 0)
        mix(absolute >>> 0)
        mix(Math.floor(absolute / 0x100000000) >>> 0)
    }

    return {
        read(item, subscriber, value) {
            mix(1)
            mix(item)
            mix(subscriber)
            mixInteger(value)
            oracleHash?.update(`read|${item}|${subscriber}|${value}\n`)
        },
        notification(item, subscriber) {
            mix(2)
            mix(item)
            mix(subscriber)
            oracleHash?.update(`notification|${item}|${subscriber}\n`)
        },
        final(value) {
            oracleHash?.update(`final|${canonicalValue(value)}\n`)
        },
        semanticChecksum() {
            return checksum.toString(16).padStart(8, "0")
        },
        oracleTraceSha256() {
            return oracleHash?.digest("hex") ?? null
        },
    }
}

function canonicalValue(value) {
    if (value === undefined) return "undefined"
    if (value === null) return "null"
    if (typeof value === "number") {
        if (Number.isNaN(value)) return "number:NaN"
        if (value === Infinity) return "number:+Infinity"
        if (value === -Infinity) return "number:-Infinity"
        if (Object.is(value, -0)) return "number:-0"
        return `number:${value}`
    }
    if (typeof value === "string") return `string:${JSON.stringify(value)}`
    if (typeof value === "boolean") return `boolean:${value}`
    if (Array.isArray(value)) {
        return `[${value.map(canonicalValue).join(",")}]`
    }
    if (typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map(key => `${JSON.stringify(key)}:${canonicalValue(value[key])}`)
            .join(",")}}`
    }
    throw new Error(`unsupported oracle value type ${typeof value}`)
}

function cloneCounters(value) {
    return JSON.parse(JSON.stringify(value))
}
