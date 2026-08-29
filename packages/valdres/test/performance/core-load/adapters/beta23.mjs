import { pathToFileURL } from "node:url"

export async function createBenchmarkAdapter({ entryPath }) {
    const runtime = await import(pathToFileURL(entryPath).href)
    requireFunction(runtime.atom, "atom")
    requireFunction(runtime.selector, "selector")
    requireFunction(runtime.store, "store")

    return {
        id: "beta23",
        implementationKind: "packed-valdres-runtime",
        instrumented: false,
        createAtom: (initialValue, name) =>
            runtime.atom(initialValue, { name }),
        createSelector: (read, name) => runtime.selector(read, { name }),
        createStore: () => runtime.store("core-load-benchmark-root"),
        createScope: (root, id) => root.scope(id),
        get: (store, state) => store.get(state),
        update: (store, state, updater) => store.set(state, updater),
        set: (store, state, value) => store.set(state, value),
        subscribe: (store, state, callback) =>
            store.sub(state, callback, false),
        dispose: root => root.dispose(),
        resetWorkCounters() {
            if (globalThis.__vp !== undefined) delete globalThis.__vp
        },
        snapshotWorkCounters() {
            const raw = globalThis.__vp
            return raw === undefined
                ? {
                      kind: "unavailable",
                      reason: "uninstrumented beta artifact",
                  }
                : { kind: "legacy-beta23-__vp", counters: { ...raw } }
        },
    }
}

function requireFunction(value, name) {
    if (typeof value !== "function") {
        throw new Error(`packed beta runtime does not export ${name}()`)
    }
}
