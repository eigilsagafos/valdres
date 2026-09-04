import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import {
    cp,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"

const rootDirectory = join(import.meta.dir, "..")
const keepWorkspace = process.env.VALDRES_KEEP_PACKED_SMOKE === "1"
const requiredBunVersion = "1.4.0"
const pinnedBunVersion = (
    await readFile(join(rootDirectory, ".bun-version"), "utf8")
).trim()
assert.equal(
    pinnedBunVersion,
    requiredBunVersion,
    ".bun-version must remain pinned to the COL-008 certification toolchain",
)
assert.equal(
    Bun.version,
    requiredBunVersion,
    "packed certification must run on the pinned Bun",
)

interface CommandResult {
    readonly stdout: string
    readonly stderr: string
}

const run = (
    label: string,
    command: readonly string[],
    cwd: string,
    environment: Readonly<Record<string, string>> = {},
): CommandResult => {
    const result = Bun.spawnSync([...command], {
        cwd,
        env: { ...process.env, ...environment },
        stdout: "pipe",
        stderr: "pipe",
    })
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()

    if (result.exitCode !== 0) {
        throw new Error(
            [
                `${label} failed with exit code ${result.exitCode}`,
                `$ ${command.join(" ")}`,
                stdout.trim(),
                stderr.trim(),
            ]
                .filter(Boolean)
                .join("\n"),
        )
    }

    console.log(`\u2713 ${label}`)
    return { stdout, stderr }
}

const writeJson = (path: string, value: unknown): Promise<void> =>
    writeFile(path, `${JSON.stringify(value, null, 4)}\n`)

const requireFile = async (path: string, label: string): Promise<void> => {
    const file = Bun.file(path)
    assert.equal(await file.exists(), true, `${label} is missing: ${path}`)
    assert.ok(file.size > 0, `${label} is empty: ${path}`)
}

interface RuntimeBuildManifestEntry {
    readonly path: string
    readonly size: number
    readonly sha256: string
}

interface RuntimeBuildEvidence {
    readonly sha256: string
    readonly files: readonly RuntimeBuildManifestEntry[]
}

const listRuntimeJavaScript = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, {
        recursive: true,
        withFileTypes: true,
    })
    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith(".js"))
        .map(entry => join(entry.parentPath, entry.name))
        .sort()
}

const runtimeBuildEvidence = async (): Promise<RuntimeBuildEvidence> => {
    const files = (
        await Promise.all(
            (["valdres", "valdres-react"] as const).map(name =>
                listRuntimeJavaScript(
                    join(rootDirectory, "packages", name, "dist"),
                ),
            ),
        )
    )
        .flat()
        .sort()
    assert.ok(files.length > 0, "certified runtime build emitted no JavaScript")
    const manifest: RuntimeBuildManifestEntry[] = []
    for (const file of files) {
        const path = relative(rootDirectory, file).replaceAll("\\", "/")
        const bytes = new Uint8Array(await readFile(file))
        const sha256 = createHash("sha256").update(bytes).digest("hex")
        manifest.push(Object.freeze({ path, size: bytes.length, sha256 }))
    }
    const sha256 = createHash("sha256")
        .update(JSON.stringify(manifest))
        .digest("hex")
    return Object.freeze({
        sha256,
        files: Object.freeze(manifest),
    })
}

const coreProbe = String.raw`
import { strict as assert } from "node:assert"
import * as core from "valdres"
import * as adapter from "valdres/adapter-internals/v1"
import * as foreignCore from "valdres-copy"
import * as foreignAdapter from "valdres-copy/adapter-internals/v1"

assert.deepEqual(Object.keys(adapter).sort(), [
    "assertStore",
    "read",
    "readHydrationSnapshot",
    "subscribe",
])

const count = core.atom(2)
const doubled = core.selector(get => get(count) * 2)
const target = core.store()
adapter.assertStore(target)
assert.equal(adapter.read(target, doubled), 4)
assert.equal(adapter.readHydrationSnapshot(target, doubled), 4)

let notifications = 0
const unsubscribe = adapter.subscribe(target, doubled, () => notifications++)
const { get, set, update, reset, txn } = target
set(count, 3)
assert.equal(get(doubled), 6)
assert.equal(notifications, 1)
update(count, current => current + 2)
assert.equal(txn(transaction => transaction.get(doubled)), 10)
assert.equal(notifications, 2)
reset(count)
assert.equal(get(count), 2)
assert.equal(notifications, 3)
unsubscribe()
unsubscribe()
set(count, 8)
assert.equal(notifications, 3)

const functionValue = core.atom(() => "initial")
let functionCalls = 0
const replacement = () => {
    functionCalls++
    return "replacement"
}
target.set(functionValue, replacement)
assert.equal(target.get(functionValue), replacement)
assert.equal(functionCalls, 0)
target.update(functionValue, previous => () => previous() + "-updated")
assert.equal(functionCalls, 0)
assert.equal(target.get(functionValue)(), "replacement-updated")
assert.equal(functionCalls, 1)

const familyAtoms = core.family((group, id) =>
    core.atom({ group, id, created: String(group) + ":" + String(id) }),
)
const firstFamilyAtom = familyAtoms("packed", 1)
assert.equal(familyAtoms("packed", 1), firstFamilyAtom)
assert.notEqual(familyAtoms("packed", 2), firstFamilyAtom)
assert.notEqual(familyAtoms("1", "packed"), firstFamilyAtom)
assert.deepEqual(target.get(firstFamilyAtom), {
    group: "packed",
    id: 1,
    created: "packed:1",
})
target.set(firstFamilyAtom, {
    group: "packed",
    id: 1,
    created: "overridden",
})
assert.equal(target.get(familyAtoms("packed", 1)).created, "overridden")

const structuredFamily = core.family(
    input => core.atom(input.payload),
    { encodeKey: input => input.id },
)
const firstStructuredMember = structuredFamily({
    id: "shared",
    payload: "first",
})
assert.equal(
    structuredFamily({ id: "shared", payload: "ignored" }),
    firstStructuredMember,
)
assert.equal(target.get(firstStructuredMember), "first")

const familySelectors = core.family(factor =>
    core.selector(get => get(count) * factor),
)
const tripled = familySelectors(3)
assert.equal(familySelectors(3), tripled)
assert.equal(target.get(tripled), 24)

const sessions = core.collection()
const firstSession = sessions("first")
const secondSession = sessions("second")
const firstPresence = core.presence(firstSession)
target.txn(transaction => {
    transaction.set(firstSession, { id: "first", revision: 1 })
    transaction.set(secondSession, { id: "second", revision: 1 })
})
const initialMembership = target.get(sessions)
assert.deepEqual(initialMembership, [firstSession, secondSession])
assert.equal(target.get(firstPresence), true)
target.update(firstSession, current => ({
    ...current,
    revision: current.revision + 1,
}))
assert.equal(target.get(sessions), initialMembership)
assert.equal(target.get(firstSession).revision, 2)
target.delete(firstSession)
assert.deepEqual(target.get(sessions), [secondSession])
target.set(firstSession, { id: "first", revision: 3 })
assert.deepEqual(target.get(sessions), [secondSession, firstSession])

const isRuntimeMismatch = error =>
    error?.name === "RuntimeMismatchError" &&
    error?.code === "VALDRES_RUNTIME_MISMATCH"

const foreignStore = foreignCore.store()
const foreignCount = foreignCore.atom(1)
const foreignSessions = foreignCore.collection()
const foreignSession = foreignSessions("foreign")
const foreignPresence = foreignCore.presence(foreignSession)
assert.throws(() => foreignAdapter.assertStore(target), isRuntimeMismatch)
assert.throws(() => adapter.assertStore(foreignStore), isRuntimeMismatch)
assert.throws(() => target.get(foreignCount), isRuntimeMismatch)
assert.throws(() => foreignStore.get(count), isRuntimeMismatch)
assert.throws(() => target.get(foreignSession), isRuntimeMismatch)
assert.throws(() => foreignStore.get(firstSession), isRuntimeMismatch)
assert.throws(() => target.get(foreignSessions), isRuntimeMismatch)
assert.throws(() => foreignStore.get(sessions), isRuntimeMismatch)
assert.throws(() => target.get(foreignPresence), isRuntimeMismatch)
assert.throws(() => foreignStore.get(firstPresence), isRuntimeMismatch)

foreignAdapter.assertStore(foreignStore)
assert.equal(foreignAdapter.read(foreignStore, foreignCount), 1)

console.log(JSON.stringify({
    runtime: typeof Bun === "undefined" ? "node" : "bun",
    sharedRootAdapterDomain: true,
    crossCopyRejected: true,
    familyIdentity: true,
    collectionLifecycle: true,
}))
`

const reactProbe = String.raw`
import { strict as assert } from "node:assert"
import { createRequire } from "node:module"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { atom, collection, presence, selector, store } from "valdres"
import { createInspectableStore } from "valdres/inspect"

// Observe useSyncExternalStore's real subscription cleanup without replacing
// either packed package. Patching the shared CommonJS React object before the
// first ESM import means valdres-react receives this transparent wrapper.
const require = createRequire(import.meta.url)
const React = require("react")
const originalUseSyncExternalStore = React.useSyncExternalStore
let activeExternalSubscriptions = 0
let externalSubscriptionCleanups = 0
const observedSubscriptions = new WeakMap()
React.useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) => {
    let observedSubscribe = observedSubscriptions.get(subscribe)
    if (observedSubscribe === undefined) {
        observedSubscribe = notify => {
            activeExternalSubscriptions++
            const unsubscribe = subscribe(notify)
            let cleaned = false
            return () => {
                if (!cleaned) {
                    cleaned = true
                    activeExternalSubscriptions--
                    externalSubscriptionCleanups++
                }
                unsubscribe()
            }
        }
        observedSubscriptions.set(subscribe, observedSubscribe)
    }
    return originalUseSyncExternalStore(
        observedSubscribe,
        getSnapshot,
        getServerSnapshot,
    )
}

const [
    { act, createElement },
    { renderToString },
    { create },
    reactApi,
    inspectReactApi,
] =
    await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("react-test-renderer"),
        import("valdres-react"),
        import("valdres-react/inspect"),
    ])

globalThis.IS_REACT_ACT_ENVIRONMENT = true
assert.equal(React.version.startsWith(process.env.EXPECTED_REACT_MAJOR + "."), true)
assert.deepEqual(Object.keys(reactApi).sort(), [
    "Provider",
    "useAtom",
    "useResetAtom",
    "useSetAtom",
    "useStore",
    "useUpdateAtom",
    "useValue",
])
assert.deepEqual(Object.keys(inspectReactApi), ["createInspectableReact"])

const {
    Provider,
    useAtom,
    useResetAtom,
    useSetAtom,
    useStore,
    useUpdateAtom,
    useValue,
} = reactApi
const { createInspectableReact } = inspectReactApi

const count = atom(1)
const functionValue = atom(() => "initial")
const doubled = selector(get => get(count) * 2)
const rootStore = store()
const childStore = rootStore.scope("packed-react-child")
const observed = {
    store: undefined,
    count: undefined,
    doubled: undefined,
    setCount: undefined,
    setFunction: undefined,
    updateFunction: undefined,
    resetCount: undefined,
    renders: 0,
}

function Probe() {
    const selectedStore = useStore()
    const [currentCount, setCount] = useAtom(count)
    const currentDoubled = useValue(doubled)
    const setFunction = useSetAtom(functionValue)
    const updateFunction = useUpdateAtom(functionValue)
    const resetCount = useResetAtom(count)
    Object.assign(observed, {
        store: selectedStore,
        count: currentCount,
        doubled: currentDoubled,
        setCount,
        setFunction,
        updateFunction,
        resetCount,
        renders: observed.renders + 1,
    })
    return createElement("output", null, currentCount + ":" + currentDoubled)
}

let renderer
await act(async () => {
    renderer = create(
        createElement(
            Provider,
            { store: rootStore },
            createElement(
                Provider,
                { store: childStore },
                createElement(Probe),
            ),
        ),
    )
})
assert.equal(observed.store, childStore)
assert.equal(observed.count, 1)
assert.equal(observed.doubled, 2)
assert.equal(activeExternalSubscriptions, 2)

await act(async () => rootStore.set(count, 2))
assert.equal(observed.count, 2)
assert.equal(observed.doubled, 4)

await act(async () => observed.setCount(5))
assert.equal(rootStore.get(count), 2)
assert.equal(childStore.get(count), 5)
assert.equal(observed.doubled, 10)

let replacementCalls = 0
const replacement = () => {
    replacementCalls++
    return "replacement"
}
await act(async () => observed.setFunction(replacement))
assert.equal(childStore.get(functionValue), replacement)
assert.equal(replacementCalls, 0)

let updaterCalls = 0
await act(async () =>
    observed.updateFunction(previous => {
        updaterCalls++
        assert.equal(previous, replacement)
        return () => previous() + "-updated"
    }),
)
assert.equal(updaterCalls, 1)
assert.equal(replacementCalls, 0)
assert.equal(childStore.get(functionValue)(), "replacement-updated")
assert.equal(replacementCalls, 1)

await act(async () => observed.resetCount())
assert.equal(childStore.get(count), 2)
assert.equal(observed.count, 2)

await act(async () => renderer.unmount())
assert.equal(activeExternalSubscriptions, 0)
assert.equal(externalSubscriptionCleanups, 2)
const rendersAfterUnmount = observed.renders
rootStore.set(count, 7)
await Promise.resolve()
assert.equal(observed.renders, rendersAfterUnmount)
assert.equal(childStore.get(count), 7)

const serverCount = atom(9)
let serverSelectorCalls = 0
const serverValue = selector(get => {
    serverSelectorCalls++
    return get(serverCount)
})
const serverStore = store()
const serverSessions = collection()
const serverSession = serverSessions("server")
serverStore.set(serverSession, { label: "ready" })
const ServerProbe = () => {
    const count = useValue(serverValue)
    const session = useValue(serverSession)
    const membership = useValue(serverSessions)
    const isPresent = useValue(presence(serverSession))
    return createElement(
        "strong",
        null,
        count + ":" + session.label + ":" + membership.length + ":" + isPresent,
    )
}
const serverTree = createElement(
    Provider,
    { store: serverStore },
    createElement(ServerProbe),
)
const html = renderToString(serverTree)
assert.match(html, />9:ready:1:true<\/strong>/)
assert.ok(serverSelectorCalls >= 1)

GlobalRegistrator.register({ url: "https://valdres.test/" })
const container = document.createElement("div")
container.innerHTML = html
document.body.append(container)
const recoverableErrors = []
const { hydrateRoot } = await import("react-dom/client")
let hydratedRoot
await act(async () => {
    hydratedRoot = hydrateRoot(container, serverTree, {
        onRecoverableError: error => recoverableErrors.push(error),
    })
})
assert.equal(container.textContent, "9:ready:1:true")
assert.deepEqual(recoverableErrors, [])
assert.equal(activeExternalSubscriptions, 4)

await act(async () =>
    serverStore.txn(transaction => {
        transaction.set(serverCount, 10)
        transaction.update(serverSession, current => ({
            label: current.label + "-updated",
        }))
    }),
)
assert.equal(container.textContent, "10:ready-updated:1:true")
await act(async () => hydratedRoot.unmount())
assert.equal(activeExternalSubscriptions, 0)
assert.equal(externalSubscriptionCleanups, 6)
await GlobalRegistrator.unregister()

const inspectionCore = createInspectableStore()
const inspectionCount = atom(0, { name: "packed-inspection-count" })
const inspectedReact = createInspectableReact(inspectionCore, {
    capacity: { summaries: 4, details: 16 },
})
let inspectedValue
const InspectedProbe = () => {
    inspectedValue = inspectedReact.useValue(inspectionCount)
    return createElement("output", null, inspectedValue)
}
let inspectedRenderer
const cleanupsBeforeInspection = externalSubscriptionCleanups
await act(async () => {
    inspectedRenderer = create(
        createElement(
            inspectedReact.Provider,
            null,
            createElement(InspectedProbe),
        ),
    )
})
assert.equal(inspectedValue, 0)
assert.equal(activeExternalSubscriptions, 1)
inspectedReact.inspect.reset()
await act(async () => {
    inspectionCore.store.txn(
        transaction => transaction.set(inspectionCount, 2),
        "packed React inspection",
    )
})
assert.equal(inspectedValue, 2)
const inspectionReport = inspectedReact.inspect.export()
assert.equal(inspectionReport.schema, "valdres.react.inspect")
assert.equal(inspectionReport.schemaVersion, 1)
assert.equal(inspectionReport.core.schemaVersion, 6)
assert.equal(inspectionReport.core.recordingId, inspectionReport.react.coreRecordingId)
assert.equal(inspectionReport.react.totals.subscriberCallbacks, 1)
assert.equal(inspectionReport.react.totals.commitTimeGroups, 1)
assert.equal(inspectionReport.react.totals.profilerCallbacks, 1)
assert.equal(inspectionReport.react.profiler.commitCallbacksObserved, true)
assert.equal(inspectionReport.react.summaries.length, 1)
assert.equal(inspectionReport.react.summaries[0].type, "react-profiler")
assert.equal(inspectionReport.react.summaries[0].commitTimeGroupId, 1)
assert.equal(inspectionReport.react.summaries[0].capture.store.id > 0, true)
assert.equal(
    inspectionReport.react.details.some(
        detail =>
            detail.type === "react-subscriber" &&
            detail.start.state?.name === "packed-inspection-count",
    ),
    true,
)
assert.equal(
    inspectionReport.core.summaries.some(
        summary =>
            summary.type === "operation" &&
            summary.name === "packed React inspection",
    ),
    true,
)
await act(async () => inspectedRenderer.unmount())
assert.equal(activeExternalSubscriptions, 0)
assert.equal(externalSubscriptionCleanups, cleanupsBeforeInspection + 1)

console.log(JSON.stringify({
    runtime: typeof Bun === "undefined" ? "node" : "bun",
    react: React.version,
    initialRender: true,
    updates: true,
    functionValues: true,
    unmountUnsubscribed: true,
    nestedScope: true,
    ssrHydration: true,
    collectionUniversalReads: true,
    inspectCorrelation: true,
}))
`

const reactInspectProductionProbe = String.raw`
import { strict as assert } from "node:assert"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { atom } from "valdres"
import { createInspectableStore } from "valdres/inspect"

GlobalRegistrator.register({ url: "https://valdres-production.test/" })
const [React, { flushSync }, { createRoot }, { createInspectableReact }] =
    await Promise.all([
        import("react"),
        import("react-dom"),
        import("react-dom/client"),
        import("valdres-react/inspect"),
    ])
assert.equal(
    React.version.startsWith(process.env.EXPECTED_REACT_MAJOR + "."),
    true,
)

const core = createInspectableStore()
const count = atom(0, { name: "production-inspection-count" })
const inspected = createInspectableReact(core, {
    capacity: { summaries: 4, details: 32 },
})
const container = document.createElement("div")
document.body.append(container)
const root = createRoot(container)
const Probe = () => React.createElement("output", null, inspected.useValue(count))

flushSync(() => {
    root.render(
        React.createElement(
            inspected.Provider,
            null,
            React.createElement(Probe),
        ),
    )
})
assert.equal(container.textContent, "0")
inspected.inspect.reset()
flushSync(() => core.store.set(count, 1))
flushSync(() => core.store.set(count, 2))
assert.equal(container.textContent, "2")

const report = inspected.inspect.export()
const subscribers = report.react.details.filter(
    detail => detail.type === "react-subscriber",
)
assert.equal(report.react.profiler.commitCallbacksObserved, false)
assert.deepEqual(report.react.summaries, [])
assert.equal(report.react.totals.profilerCallbacks, 0)
assert.equal(report.react.totals.commitTimeGroups, 0)
assert.equal(report.react.totals.subscriberCallbacks, 2)
assert.equal(
    report.react.totals.clientSnapshotsDuringSubscriberCallbacks,
    2,
)
assert.equal(subscribers.length, 2)
assert.equal(new Set(subscribers.map(detail => detail.start.commitId)).size, 2)
assert.equal(report.react.complete, true)
assert.equal(report.complete, true)

flushSync(() => root.unmount())
await GlobalRegistrator.unregister()

console.log(JSON.stringify({
    runtime: "node",
    react: React.version,
    productionSubscriberTimeline: true,
    fabricatedProfilerCommits: false,
}))
`

const typeProbe = String.raw`
import {
    atom,
    collection,
    family,
    presence,
    selector,
    store,
    type Atom,
    type AtomUpdater,
    type Collection,
    type CollectionKey,
    type CollectionOptions,
    type CollectionRow,
    type CollectionValue,
    type FamilyKey,
    type Selector,
    type State,
    type Store,
} from "valdres"
import {
    Provider,
    useAtom,
    useResetAtom,
    useSetAtom,
    useStore,
    useUpdateAtom,
    useValue,
} from "valdres-react"
import {
    createInspectableReact,
    type InspectableReactExport,
    type InspectableReactResult,
} from "valdres-react/inspect"
import {
    createInspectableStore,
    type CycleSearchInspectionDetail,
    type InspectionCycleTotals,
    type InspectionNewEdgeProofMemoTotals,
    type InspectionReverseProofOutcome,
    type InspectionReverseProofTotals,
    type InspectionTopologyDeltaReverseSnapshotTotals,
    type StateInspectionCapture,
} from "valdres/inspect"

const count = atom(0)
const doubled = selector(get => get(count) * 2)
const target: Store = store()
const state: State<number> = doubled
const update: AtomUpdater<number> = current => current + 1

const value: number = useValue(state, target)
const pair: readonly [number, (value: number) => void] = useAtom(count, target)
const set: (value: number) => void = useSetAtom(count, target)
const apply: (update: AtomUpdater<number>) => void = useUpdateAtom(count, target)
const reset: () => void = useResetAtom(count, target)
const selected: Store = useStore()
const inspectableCore = createInspectableStore()
const inspectedReact: InspectableReactResult =
    createInspectableReact(inspectableCore)
const capture: StateInspectionCapture =
    inspectableCore.inspect.capture(inspectableCore.store, count)
const inspectionReport: InspectableReactExport =
    inspectedReact.inspect.export()
const coreSchemaVersion: 6 = inspectionReport.core.schemaVersion
const proofMemoTotals: InspectionNewEdgeProofMemoTotals =
    inspectionReport.core.summaries[0]!.totals.cycle.newEdgeProofMemo
const reverseProofTotals: InspectionReverseProofTotals =
    inspectionReport.core.summaries[0]!.totals.cycle.reverseProof
const topologyDeltaSnapshotTotals: InspectionTopologyDeltaReverseSnapshotTotals =
    reverseProofTotals.topologyDeltaSnapshot
const reverseProofOutcome: InspectionReverseProofOutcome = "proven"
const topologyDeltaSite: CycleSearchInspectionDetail["site"] =
    "topology-delta-proof"
const topologyDeltaSearches: InspectionCycleTotals["bySite"]["topologyDeltaProof"] =
    0
const topologyDeltaBucket: InspectionCycleTotals["byLane"]["committed"]["topologyDeltaProof"] =
    inspectionReport.core.summaries[0]?.totals.cycle.byLane.committed
        .topologyDeltaProof ?? {
        searches: 0,
        visits: 0,
        maxVisits: 0,
        found: 0,
    }

const primitiveKey: FamilyKey = Symbol("packed-key")
const familyAtoms = family((group: string, id: number) =>
    atom({ group, id }),
)
const familySelectors = family((factor: number) =>
    selector(get => get(count) * factor),
)
const atomMember: Atom<{ group: string; id: number }> = familyAtoms(
    "packed",
    1,
)
const selectorMember: Selector<number> = familySelectors(3)
const structuredFamily = family(
    (input: { readonly id: string; readonly payload: number }) =>
        atom(input.payload),
    { encodeKey: input => input.id },
)
const structuredMember: Atom<number> = structuredFamily({
    id: "packed",
    payload: 1,
})

export interface PackedSession {
    readonly id: string
    readonly active: boolean
}
export interface PackedSessionLookup {
    readonly tenant: string
    readonly id: string
}
export const packedSessions = collection<string, PackedSession>()
export const richPackedSessions = collection<
    string,
    PackedSession,
    PackedSessionLookup
>({
    encodeKey: input => input.tenant + ":" + input.id,
})
export const packedSessionRow: CollectionRow<string, PackedSession> =
    packedSessions("session")
export const packedMembership: Collection<string, PackedSession> =
    packedSessions
export const packedPresence: Selector<boolean> = presence(packedSessionRow)
export const directCollectionOptions: CollectionOptions<
    string,
    PackedSession
> = {}
export const richCollectionOptions: CollectionOptions<
    string,
    PackedSession,
    PackedSessionLookup
> = {
    encodeKey: input => input.tenant + ":" + input.id,
}
export const defineDirectCollection = <
    Key extends CollectionKey,
    Value extends CollectionValue,
>() => collection<Key, Value>()
export const defineRichCollection = <
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
>(options: CollectionOptions<Key, Value, Input>) =>
    collection<Key, Value, Input>(options)

apply(update)
void Provider
void value
void pair
void reset
void selected
void capture
void inspectionReport
void coreSchemaVersion
void proofMemoTotals
void reverseProofTotals
void topologyDeltaSnapshotTotals
void reverseProofOutcome
void topologyDeltaSite
void topologyDeltaSearches
void topologyDeltaBucket
void primitiveKey
void atomMember
void selectorMember
void structuredMember

target.set(packedSessionRow, { id: "session", active: true })
target.delete(packedSessionRow)

// @ts-expect-error Selectors are read-only and cannot be passed to Atom setters.
useSetAtom(doubled, target)
// @ts-expect-error Exact setters do not interpret functions as updater syntax.
set(current => current + 1)
// @ts-expect-error Structured family arguments require an explicit encoder.
family((input: { readonly id: string }) => atom(input.id))
// @ts-expect-error Collection values cannot include undefined.
collection<string, PackedSession | undefined>()
// @ts-expect-error Atom deletion is not part of the collection mutation lane.
target.delete(count)
// @ts-expect-error FamilyKey excludes structured objects.
const structuredKey: FamilyKey = { id: "packed" }
void structuredKey
`

const bundleEntry = String.raw`
import { atom, collection, family, presence, store } from "valdres"
import * as reactApi from "valdres-react"

export const bundleSmoke = () => {
    const count = atom(4)
    const target = store()
    target.update(count, current => current + 1)
    const members = family(
        input => atom(input.payload),
        { encodeKey: input => input.id },
    )
    const first = members({ id: "shared", payload: "first" })
    const collision = members({ id: "shared", payload: "ignored" })
    const sessions = collection()
    const session = sessions("bundle")
    target.set(session, { id: "bundle" })
    return {
        value: target.get(count),
        familyValue: target.get(first),
        familyIdentity: first === collision,
        collectionValue: target.get(session).id,
        collectionMembership: target.get(sessions).length,
        collectionPresence: target.get(presence(session)),
        reactExports: Object.keys(reactApi).sort(),
    }
}
`

const inspectBundleEntry = String.raw`
import { createInspectableStore } from "valdres/inspect"
import { createInspectableReact } from "valdres-react/inspect"

export const inspectBundleSmoke = () => {
    const core = createInspectableStore()
    const inspected = createInspectableReact(core, {
        capacity: { summaries: 1, details: 0 },
    })
    const report = inspected.inspect.export()
    return {
        schema: report.schema,
        coreRecordingId: report.core.recordingId,
        reactCoreRecordingId: report.react.coreRecordingId,
        surface: Object.keys(inspected),
    }
}
`

const bundleProbe = String.raw`
import { strict as assert } from "node:assert"
import { bundleSmoke } from "./bundle.mjs"

assert.deepEqual(bundleSmoke(), {
    value: 5,
    familyValue: "first",
    familyIdentity: true,
    collectionValue: "bundle",
    collectionMembership: 1,
    collectionPresence: true,
    reactExports: [
        "Provider",
        "useAtom",
        "useResetAtom",
        "useSetAtom",
        "useStore",
        "useUpdateAtom",
        "useValue",
    ],
})
`

const inspectBundleProbe = String.raw`
import { strict as assert } from "node:assert"
import { inspectBundleSmoke } from "./inspect-bundle.mjs"

const result = inspectBundleSmoke()
assert.equal(result.schema, "valdres.react.inspect")
assert.equal(result.coreRecordingId, result.reactCoreRecordingId)
assert.deepEqual(result.surface, [
    "Provider",
    "useValue",
    "useAtom",
    "useStore",
    "useSetAtom",
    "useUpdateAtom",
    "useResetAtom",
    "inspect",
])
`

interface PackedPackage {
    readonly name: "valdres" | "valdres-react"
    readonly tarball: string
}

interface ReactMatrixEntry {
    readonly major: "18" | "19"
    readonly runtimeVersion: string
    readonly typesVersion: string
}

const reactMatrix: readonly ReactMatrixEntry[] = [
    { major: "18", runtimeVersion: "18.3.1", typesVersion: "18.3.31" },
    { major: "19", runtimeVersion: "19.1.1", typesVersion: "19.2.3" },
]

const workspace = await mkdtemp(join(tmpdir(), "valdres-v1-beta-packed-"))
let passed = false

try {
    const sourceManifests = new Map<string, string>()
    const parsedSourceManifests = new Map<string, Record<string, unknown>>()
    for (const name of ["valdres", "valdres-react"] as const) {
        const manifestPath = join(
            rootDirectory,
            "packages",
            name,
            "package.json",
        )
        const sourceManifest = await readFile(manifestPath, "utf8")
        const parsedManifest = JSON.parse(sourceManifest) as Record<
            string,
            unknown
        >
        assert.equal(
            Object.hasOwn(parsedManifest, "gitHead"),
            false,
            `${name} source manifest must leave gitHead to npm`,
        )
        sourceManifests.set(name, sourceManifest)
        parsedSourceManifests.set(name, parsedManifest)
    }

    const coreSourceManifest = parsedSourceManifests.get("valdres")!
    const reactSourceManifest = parsedSourceManifests.get("valdres-react")!
    const coreBetaVersion = coreSourceManifest.version
    const reactBetaVersion = reactSourceManifest.version
    const reactCorePeer = (
        reactSourceManifest.peerDependencies as
            | Record<string, unknown>
            | undefined
    )?.valdres
    const betaVersions = {
        valdres: coreBetaVersion,
        "valdres-react": reactBetaVersion,
    } as const

    for (const [name, version] of Object.entries(betaVersions)) {
        if (
            typeof version !== "string" ||
            !/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)
        ) {
            throw new Error(
                `${name} packed beta version must be an x.y.z-beta.N version, received ${version}`,
            )
        }
    }
    assert.equal(
        typeof reactCorePeer,
        "string",
        "valdres-react must declare its valdres peer range",
    )

    const buildEvidence: RuntimeBuildEvidence[] = []
    for (let build = 1; build <= 3; build++) {
        run(
            `build core and React JavaScript (${build}/3)`,
            ["bun", "run", "build:v1-beta"],
            rootDirectory,
        )
        buildEvidence.push(await runtimeBuildEvidence())
    }
    for (const evidence of buildEvidence.slice(1)) {
        assert.deepEqual(
            evidence.files,
            buildEvidence[0]!.files,
            "three pinned-Bun runtime builds must emit identical paths, sizes, and bytes",
        )
        assert.equal(
            evidence.sha256,
            buildEvidence[0]!.sha256,
            "three pinned-Bun runtime build digests must match",
        )
    }
    const certifiedRuntimeBuildSha256 = buildEvidence[0]!.sha256
    const sizeBudget = JSON.parse(
        await readFile(
            join(rootDirectory, "scripts", "size-baseline.json"),
            "utf8",
        ),
    ) as {
        provenance?: { certifiedRuntimeBuildSha256?: string }
    }
    const reviewedDigest = sizeBudget.provenance?.certifiedRuntimeBuildSha256
    if (reviewedDigest !== "PENDING_COL008_CERTIFICATION") {
        assert.equal(
            certifiedRuntimeBuildSha256,
            reviewedDigest,
            "runtime build differs from the reviewed COL-008 certification digest",
        )
    }
    console.log(
        `\u2713 three byte-identical pinned-Bun runtime builds (${certifiedRuntimeBuildSha256})`,
    )
    run(
        "build core and React declarations",
        ["bun", "run", "build:types:v1-beta"],
        rootDirectory,
    )

    const stageDirectory = join(workspace, "stage")
    const artifactDirectory = join(workspace, "artifacts")
    await mkdir(join(stageDirectory, "scripts"), { recursive: true })
    await mkdir(artifactDirectory, { recursive: true })
    await Promise.all(
        ["prepack.ts", "publish-metadata.ts"].map(file =>
            cp(
                join(rootDirectory, "scripts", file),
                join(stageDirectory, "scripts", file),
            ),
        ),
    )

    const packedPackages: PackedPackage[] = []
    for (const name of ["valdres", "valdres-react"] as const) {
        const sourceDirectory = join(rootDirectory, "packages", name)
        const packageDirectory = join(stageDirectory, "packages", name)
        await mkdir(packageDirectory, { recursive: true })
        await cp(
            join(sourceDirectory, "dist"),
            join(packageDirectory, "dist"),
            {
                recursive: true,
            },
        )

        const manifest = JSON.parse(sourceManifests.get(name)!) as Record<
            string,
            unknown
        >
        const betaVersion = betaVersions[name]
        manifest.gitHead = "0000000000000000000000000000000000000000"
        await writeJson(join(packageDirectory, "package.json"), manifest)

        run(
            `prepack shadow ${name}`,
            ["bun", "run", join(stageDirectory, "scripts", "prepack.ts")],
            packageDirectory,
        )

        const prepackedManifest = JSON.parse(
            await readFile(join(packageDirectory, "package.json"), "utf8"),
        ) as {
            version: string
            gitHead?: unknown
            scripts?: unknown
            devDependencies?: unknown
            sideEffects?: unknown
            peerDependencies?: Record<string, string>
            exports: Record<
                string,
                { types: string; import?: string; default: string }
            >
        }
        assert.equal(prepackedManifest.version, betaVersion)
        assert.equal(prepackedManifest.gitHead, undefined)
        assert.equal(prepackedManifest.scripts, undefined)
        assert.equal(prepackedManifest.devDependencies, undefined)
        if (name === "valdres") {
            assert.equal(prepackedManifest.sideEffects, false)
        } else {
            assert.equal(
                prepackedManifest.peerDependencies?.valdres,
                reactCorePeer,
            )
        }
        for (const [exportPath, targets] of Object.entries(
            prepackedManifest.exports,
        )) {
            await requireFile(
                join(packageDirectory, targets.types),
                `${name} ${exportPath} declaration export`,
            )
            await requireFile(
                join(packageDirectory, targets.import ?? targets.default),
                `${name} ${exportPath} runtime export`,
            )
        }

        const packed = run(
            `npm pack shadow ${name}`,
            [
                "npm",
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                artifactDirectory,
            ],
            packageDirectory,
            { npm_config_loglevel: "error" },
        )
        const packResult = JSON.parse(packed.stdout) as [
            { filename: string; files: { path: string }[] },
        ]
        assert.equal(packResult.length, 1)
        const packedFiles = new Set(packResult[0].files.map(file => file.path))
        assert.equal(packedFiles.has("dist/index.js"), true)
        assert.equal(packedFiles.has("dist/types/index.d.ts"), true)
        if (name === "valdres") {
            assert.equal(packedFiles.has("dist/adapter-internals/v1.js"), true)
            assert.equal(
                packedFiles.has("dist/types/adapter-internals/v1.d.ts"),
                true,
            )
        } else {
            assert.equal(packedFiles.has("dist/inspect.js"), true)
            assert.equal(packedFiles.has("dist/types/inspect.d.ts"), true)
        }
        packedPackages.push({
            name,
            tarball: join(artifactDirectory, basename(packResult[0].filename)),
        })
    }

    for (const [name, original] of sourceManifests) {
        assert.equal(
            await readFile(
                join(rootDirectory, "packages", name, "package.json"),
                "utf8",
            ),
            original,
            `${name} source manifest changed while shadow-packing`,
        )
    }
    console.log(
        "\u2713 source package manifests remained byte-for-byte unchanged",
    )

    const coreTarball = packedPackages.find(
        pkg => pkg.name === "valdres",
    )!.tarball
    const reactTarball = packedPackages.find(
        pkg => pkg.name === "valdres-react",
    )!.tarball

    const sizeCertification = run(
        "certify final packed core size budgets",
        [
            process.execPath,
            "run",
            join(rootDirectory, "scripts", "check-package-size.ts"),
            coreTarball,
        ],
        rootDirectory,
    )
    console.log(sizeCertification.stdout.trim())

    for (const react of reactMatrix) {
        const consumerDirectory = join(workspace, `react-${react.major}`)
        await mkdir(consumerDirectory, { recursive: true })
        await writeJson(join(consumerDirectory, "package.json"), {
            name: `valdres-packed-react-${react.major}-probe`,
            private: true,
            type: "module",
        })

        run(
            `install packed packages with React ${react.runtimeVersion}`,
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--no-package-lock",
                coreTarball,
                reactTarball,
                `react@${react.runtimeVersion}`,
                `react-dom@${react.runtimeVersion}`,
                `react-test-renderer@${react.runtimeVersion}`,
                `@types/react@${react.typesVersion}`,
                "@happy-dom/global-registrator@20.0.5",
            ],
            consumerDirectory,
            { npm_config_loglevel: "error" },
        )

        const installedCoreManifest = JSON.parse(
            await readFile(
                join(
                    consumerDirectory,
                    "node_modules",
                    "valdres",
                    "package.json",
                ),
                "utf8",
            ),
        ) as {
            version: string
            sideEffects: unknown
            scripts?: unknown
            devDependencies?: unknown
        }
        const installedReactManifest = JSON.parse(
            await readFile(
                join(
                    consumerDirectory,
                    "node_modules",
                    "valdres-react",
                    "package.json",
                ),
                "utf8",
            ),
        ) as {
            version: string
            exports: Record<string, unknown>
        }
        assert.equal(installedCoreManifest.version, coreBetaVersion)
        assert.equal(installedReactManifest.version, reactBetaVersion)
        assert.deepEqual(Object.keys(installedReactManifest.exports).sort(), [
            ".",
            "./inspect",
        ])
        assert.equal(installedCoreManifest.sideEffects, false)
        assert.equal(installedCoreManifest.scripts, undefined)
        assert.equal(installedCoreManifest.devDependencies, undefined)

        const installedCoreDirectory = join(
            consumerDirectory,
            "node_modules",
            "valdres",
        )
        const copiedCoreDirectory = join(
            consumerDirectory,
            "node_modules",
            "valdres-copy",
        )
        await cp(installedCoreDirectory, copiedCoreDirectory, {
            recursive: true,
        })
        const copiedManifestPath = join(copiedCoreDirectory, "package.json")
        const copiedManifest = JSON.parse(
            await readFile(copiedManifestPath, "utf8"),
        ) as Record<string, unknown>
        copiedManifest.name = "valdres-copy"
        await writeJson(copiedManifestPath, copiedManifest)

        await Promise.all([
            writeFile(join(consumerDirectory, "core-probe.mjs"), coreProbe),
            writeFile(join(consumerDirectory, "react-probe.mjs"), reactProbe),
            writeFile(
                join(consumerDirectory, "react-inspect-production-probe.mjs"),
                reactInspectProductionProbe,
            ),
            writeFile(join(consumerDirectory, "types-probe.ts"), typeProbe),
            writeFile(join(consumerDirectory, "bundle-entry.mjs"), bundleEntry),
            writeFile(join(consumerDirectory, "bundle-probe.mjs"), bundleProbe),
            writeFile(
                join(consumerDirectory, "inspect-bundle-entry.mjs"),
                inspectBundleEntry,
            ),
            writeFile(
                join(consumerDirectory, "inspect-bundle-probe.mjs"),
                inspectBundleProbe,
            ),
            writeJson(join(consumerDirectory, "tsconfig.json"), {
                compilerOptions: {
                    declaration: true,
                    emitDeclarationOnly: true,
                    target: "ES2022",
                    lib: ["ES2022", "DOM", "DOM.Iterable"],
                    module: "NodeNext",
                    moduleResolution: "NodeNext",
                    strict: true,
                    outDir: "types-output",
                    skipLibCheck: false,
                    exactOptionalPropertyTypes: true,
                    types: ["react"],
                },
                include: ["types-probe.ts"],
            }),
        ])

        run(
            `Node core/domain probe (React ${react.major} consumer)`,
            ["node", "core-probe.mjs"],
            consumerDirectory,
        )
        run(
            `Bun core/domain probe (React ${react.major} consumer)`,
            ["bun", "core-probe.mjs"],
            consumerDirectory,
        )
        run(
            `Node React ${react.major} behavior and hydration probe`,
            ["node", "react-probe.mjs"],
            consumerDirectory,
            { EXPECTED_REACT_MAJOR: react.major },
        )
        run(
            `Bun React ${react.major} behavior and hydration probe`,
            ["bun", "react-probe.mjs"],
            consumerDirectory,
            { EXPECTED_REACT_MAJOR: react.major },
        )
        run(
            `Node React ${react.major} production inspection probe`,
            ["node", "react-inspect-production-probe.mjs"],
            consumerDirectory,
            {
                EXPECTED_REACT_MAJOR: react.major,
                NODE_ENV: "production",
            },
        )

        run(
            `TypeScript declaration emit with React ${react.major}`,
            [
                "node",
                join(rootDirectory, "node_modules", "typescript", "bin", "tsc"),
                "-p",
                "tsconfig.json",
            ],
            consumerDirectory,
        )
        const emittedConsumerDeclaration = await readFile(
            join(consumerDirectory, "types-output", "types-probe.d.ts"),
            "utf8",
        )
        assert.match(emittedConsumerDeclaration, /packedSessions/)
        assert.match(emittedConsumerDeclaration, /richPackedSessions/)
        assert.match(emittedConsumerDeclaration, /defineDirectCollection/)
        assert.match(emittedConsumerDeclaration, /defineRichCollection/)
        assert.equal(
            emittedConsumerDeclaration.includes("v1-internal"),
            false,
            "installed collection declarations must remain publicly nameable",
        )
        run(
            `esbuild browser bundle with React ${react.major}`,
            [
                "node",
                join(
                    rootDirectory,
                    "node_modules",
                    "esbuild",
                    "bin",
                    "esbuild",
                ),
                "bundle-entry.mjs",
                "--bundle",
                "--platform=browser",
                "--format=esm",
                "--outfile=bundle.mjs",
                "--metafile=bundle-meta.json",
                "--log-level=warning",
            ],
            consumerDirectory,
        )
        const bundleInputs = Object.keys(
            (
                JSON.parse(
                    await readFile(
                        join(consumerDirectory, "bundle-meta.json"),
                        "utf8",
                    ),
                ) as { inputs: Record<string, unknown> }
            ).inputs,
        ).map(path => path.replaceAll("\\", "/"))
        assert.equal(
            bundleInputs.some(path => path.endsWith("dist/inspect.js")),
            false,
            "root-only valdres-react consumer must not reach the inspect entry",
        )
        run(
            `execute esbuild output for React ${react.major}`,
            ["node", "bundle-probe.mjs"],
            consumerDirectory,
        )
        run(
            `esbuild inspection subpath with React ${react.major}`,
            [
                "node",
                join(
                    rootDirectory,
                    "node_modules",
                    "esbuild",
                    "bin",
                    "esbuild",
                ),
                "inspect-bundle-entry.mjs",
                "--bundle",
                "--platform=browser",
                "--format=esm",
                "--outfile=inspect-bundle.mjs",
                "--log-level=warning",
            ],
            consumerDirectory,
        )
        run(
            `execute inspection bundle for React ${react.major}`,
            ["node", "inspect-bundle-probe.mjs"],
            consumerDirectory,
        )
    }

    passed = true
    console.log(
        `\nPacked valdres@${coreBetaVersion} + valdres-react@${reactBetaVersion} consumer smoke passed for Node, Bun, TypeScript, esbuild, React 18, and React 19.`,
    )
} finally {
    if (keepWorkspace || !passed) {
        console.log(`Packed smoke workspace retained at ${workspace}`)
    } else {
        await rm(workspace, { recursive: true, force: true })
    }
}
