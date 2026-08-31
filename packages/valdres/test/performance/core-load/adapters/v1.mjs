import { pathToFileURL } from "node:url"

const COUNTERS_SYMBOL = Symbol.for("valdres.test.coreCounters.v1")

export async function createBenchmarkAdapter({ entryPath }) {
    const runtime = await import(pathToFileURL(entryPath).href)
    requireFunction(runtime.atom, "atom")
    requireFunction(runtime.selector, "selector")
    requireFunction(runtime.store, "store")

    return {
        id: "v1",
        implementationKind: "packed-valdres-runtime",
        get instrumented() {
            return currentInstrumentation() !== null
        },
        createAtom: (initialValue, name) =>
            runtime.atom(initialValue, { name }),
        createSelector: (read, name) => runtime.selector(read, { name }),
        createStore: () => runtime.store(),
        createScope: (root, id) => root.scope(id),
        get: (store, state) => store.get(state),
        update: (store, state, updater) => store.update(state, updater),
        set: (store, state, value) => store.set(state, value),
        subscribe: (store, state, callback) => store.sub(state, callback),
        dispose: root => root.dispose(),
        resetWorkCounters() {
            return currentInstrumentation()?.reset()
        },
        snapshotWorkCounters() {
            const instrumentation = currentInstrumentation()
            return instrumentation !== null
                ? {
                      kind: "valdres-v1-core-counters",
                      counters: instrumentation.snapshot(),
                  }
                : {
                      kind: "unavailable",
                      reason: "packed artifact has no test counter instrumentation",
                  }
        },
    }
}

function currentInstrumentation() {
    const instrumentation = globalThis[COUNTERS_SYMBOL]
    return instrumentation !== undefined &&
        typeof instrumentation.reset === "function" &&
        typeof instrumentation.snapshot === "function"
        ? instrumentation
        : null
}

function requireFunction(value, name) {
    if (typeof value !== "function") {
        throw new Error(`packed v1 runtime does not export ${name}()`)
    }
}
