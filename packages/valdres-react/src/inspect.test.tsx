import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { act, cleanup, render, renderHook } from "@testing-library/react"
import {
    Component,
    useLayoutEffect,
    type ErrorInfo,
    type ReactElement,
    type ReactNode,
} from "react"
import { renderToString } from "react-dom/server"
import { atom, selector, type Store } from "valdres"
import { createInspectableStore } from "valdres/inspect"
import { Provider as RootProvider } from "./Provider"
import {
    createInspectableReact,
    type InspectableReactExport,
    type ReactInspectionDetail,
} from "./inspect"
import { useStore as useRootStore } from "./useStore"
import { useValue as useRootValue } from "./useValue"

afterEach(cleanup)

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const assertJsonSafe = (
    value: unknown,
    ancestors: Set<object> = new Set(),
): void => {
    if (value === null) return
    switch (typeof value) {
        case "string":
        case "boolean":
            return
        case "number":
            expect(Number.isFinite(value)).toBe(true)
            return
        case "object": {
            if (ancestors.has(value)) {
                throw new Error("React inspection export contains a cycle")
            }
            ancestors.add(value)
            for (const key of Reflect.ownKeys(value)) {
                expect(typeof key).toBe("string")
                assertJsonSafe(Reflect.get(value, key), ancestors)
            }
            ancestors.delete(value)
            return
        }
        default:
            throw new Error(
                `React inspection export contains non-JSON value: ${typeof value}`,
            )
    }
}

const detailsOfType = <Type extends ReactInspectionDetail["type"]>(
    recording: InspectableReactExport,
    type: Type,
): readonly Extract<ReactInspectionDetail, { readonly type: Type }>[] =>
    recording.react.details.filter(
        (
            detail,
        ): detail is Extract<ReactInspectionDetail, { readonly type: Type }> =>
            detail.type === type,
    )

class ErrorBoundary extends Component<
    Readonly<{ children: ReactNode }>,
    Readonly<{ failed: boolean }>
> {
    state = { failed: false }

    static getDerivedStateFromError(): Readonly<{ failed: boolean }> {
        return { failed: true }
    }

    componentDidCatch(_error: unknown, _info: ErrorInfo): void {}

    render(): ReactNode {
        return this.state.failed ? <span>failed</span> : this.props.children
    }
}

describe("createInspectableReact", () => {
    test("returns one frozen facade and preserves scoped Store selection", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const scopedStore = core.store.scope()
        scopedStore.set(count, 4)
        const inspected = createInspectableReact(core)
        const wrapper = ({
            children,
        }: {
            readonly children: ReactNode
        }): ReactElement => (
            <inspected.Provider store={scopedStore}>
                {children}
            </inspected.Provider>
        )
        const { result } = renderHook(
            () =>
                [
                    inspected.useStore(),
                    inspected.useAtom(count),
                    inspected.useUpdateAtom(count),
                    inspected.useResetAtom(count),
                ] as const,
            { wrapper },
        )

        expect(Object.keys(inspected)).toEqual([
            "Provider",
            "useValue",
            "useAtom",
            "useStore",
            "useSetAtom",
            "useUpdateAtom",
            "useResetAtom",
            "inspect",
        ])
        expect(Object.isFrozen(inspected)).toBe(true)
        expect(Object.isFrozen(inspected.inspect)).toBe(true)
        expect(result.current[0]).toBe(scopedStore)
        expect(result.current[1][0]).toBe(4)

        act(() => result.current[1][1](7))
        expect(scopedStore.get(count)).toBe(7)
        act(() => result.current[2](current => current + 1))
        expect(scopedStore.get(count)).toBe(8)
        act(() => result.current[3]())
        expect(scopedStore.get(count)).toBe(0)
        expect(core.store.get(count)).toBe(0)
    })

    test("interoperates with the shared Provider and rejects foreign Stores", () => {
        const count = atom(1)
        const core = createInspectableStore()
        const scopedStore = core.store.scope()
        const foreign = createInspectableStore().store
        const inspected = createInspectableReact(core)
        const { result } = renderHook(() => inspected.useValue(count), {
            wrapper: ({ children }: { readonly children: ReactNode }) => (
                <RootProvider store={scopedStore}>{children}</RootProvider>
            ),
        })
        inspected.inspect.reset()

        act(() => scopedStore.set(count, 2))
        act(() => scopedStore.set(count, 3))
        expect(result.current).toBe(3)
        const fallbackRecording = inspected.inspect.export()
        const fallbackSubscribers = detailsOfType(
            fallbackRecording,
            "react-subscriber",
        )
        expect(fallbackRecording.react).toMatchObject({
            profiler: { commitCallbacksObserved: false },
            complete: true,
            totals: {
                commitTimeGroups: 0,
                profilerCallbacks: 0,
                subscriberCallbacks: 2,
            },
        })
        const fallbackCoreCommitIds = fallbackRecording.core.summaries
            .filter(summary => summary.type === "commit")
            .map(summary => summary.commitId)
        expect(
            fallbackSubscribers.map(detail => detail.start.commitId),
        ).toEqual(fallbackCoreCommitIds)
        expect(() =>
            render(
                <inspected.Provider store={foreign}>
                    <div />
                </inspected.Provider>,
            ),
        ).toThrow("owned by this inspector")
        expect(() =>
            renderHook(() => inspected.useValue(count, foreign)),
        ).toThrow("owned by this inspector")
    })

    test("keeps production timelines truthful without Profiler callbacks", () => {
        const source = `
            import { GlobalRegistrator } from "@happy-dom/global-registrator"
            GlobalRegistrator.register()
            const [{ createElement }, { createRoot }, { flushSync }, valdres, coreApi, reactApi] = await Promise.all([
                import("react"),
                import("react-dom/client"),
                import("react-dom"),
                import("valdres"),
                import("valdres/inspect"),
                import("./src/inspect.tsx"),
            ])
            const count = valdres.atom(0)
            const core = coreApi.createInspectableStore()
            const inspected = reactApi.createInspectableReact(core)
            const Counter = () => createElement("span", null, inspected.useValue(count))
            const host = document.createElement("div")
            const root = createRoot(host)
            flushSync(() => root.render(createElement(inspected.Provider, null, createElement(Counter))))
            inspected.inspect.reset()
            flushSync(() => core.store.set(count, 1))
            flushSync(() => core.store.set(count, 2))
            const report = inspected.inspect.export()
            const subscribers = report.react.details.filter(detail => detail.type === "react-subscriber")
            const coreCommitIds = report.core.summaries.filter(summary => summary.type === "commit").map(summary => summary.commitId)
            const result = {
                value: host.textContent,
                complete: report.react.complete,
                profilerObserved: report.react.profiler.commitCallbacksObserved,
                profilerCallbacks: report.react.totals.profilerCallbacks,
                summaries: report.react.summaries.length,
                subscriberCallbacks: report.react.totals.subscriberCallbacks,
                subscriberCommitIds: subscribers.map(detail => detail.start.commitId),
                coreCommitIds,
            }
            flushSync(() => root.unmount())
            console.log("VALDRES_RESULT:" + JSON.stringify(result))
        `
        const child = Bun.spawnSync({
            cmd: [process.execPath, "-e", source],
            cwd: `${import.meta.dir}/..`,
            env: { ...process.env, NODE_ENV: "production" },
            stdout: "pipe",
            stderr: "pipe",
        })
        expect(child.exitCode, child.stderr.toString()).toBe(0)
        const resultLine = child.stdout
            .toString()
            .split("\n")
            .find(line => line.startsWith("VALDRES_RESULT:"))
        expect(resultLine).toBeDefined()
        const result = JSON.parse(
            (resultLine ?? "").slice("VALDRES_RESULT:".length),
        ) as Readonly<{
            value: string
            complete: boolean
            profilerObserved: boolean
            profilerCallbacks: number
            summaries: number
            subscriberCallbacks: number
            subscriberCommitIds: number[]
            coreCommitIds: number[]
        }>

        expect(result).toEqual({
            value: "2",
            complete: true,
            profilerObserved: false,
            profilerCallbacks: 0,
            summaries: 0,
            subscriberCallbacks: 2,
            subscriberCommitIds: result.coreCommitIds,
            coreCommitIds: result.coreCommitIds,
        })
        expect(result.coreCommitIds).toHaveLength(2)
    })

    test("makes its selected Store visible to ordinary root hooks", () => {
        const count = atom(1)
        const core = createInspectableStore()
        const scopedStore = core.store.scope()
        scopedStore.set(count, 5)
        const inspected = createInspectableReact(core)
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider store={scopedStore}>
                {children}
            </inspected.Provider>
        )
        const { result } = renderHook(
            () => [useRootStore(), useRootValue(count)] as const,
            { wrapper },
        )

        expect(result.current).toEqual([scopedStore, 5])

        act(() => scopedStore.set(count, 6))
        expect(result.current).toEqual([scopedStore, 6])
    })

    test("does not notify React for an equality-suppressed write", () => {
        const value = atom(
            { count: 1 },
            {
                equal: (previous, next) => previous.count === next.count,
            },
        )
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        const { result } = renderHook(() => inspected.useValue(value), {
            wrapper,
        })
        const initial = result.current
        inspected.inspect.reset()

        act(() => core.store.set(value, { count: 1 }))

        const recording = inspected.inspect.export()
        expect(result.current).toBe(initial)
        expect(recording.react.summaries).toEqual([])
        expect(recording.react.details).toEqual([])
        expect(recording.react.totals).toMatchObject({
            commitTimeGroups: 0,
            profilerCallbacks: 0,
            subscriberCallbacks: 0,
            snapshots: 0,
        })
    })

    test("records core callbacks and React Profiler boundaries independently", () => {
        const secret = "raw-value-must-not-enter-the-report"
        const count = atom(0, { name: "count" })
        const message = selector(get => `${secret}:${get(count)}`, {
            name: "message",
        })
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        const { result } = renderHook(() => inspected.useValue(message), {
            wrapper,
        })
        inspected.inspect.reset()

        act(() => {
            core.store.set(count, 1)
            core.store.set(count, 2)
        })

        expect(result.current).toBe(`${secret}:2`)
        const recording = inspected.inspect.export()
        const coreCommitIds = recording.core.summaries
            .filter(summary => summary.type === "commit")
            .map(summary => summary.commitId)
        const [profiler] = recording.react.summaries
        const subscribers = detailsOfType(recording, "react-subscriber")
        const snapshots = detailsOfType(recording, "react-snapshot")

        expect(recording).toMatchObject({
            schema: "valdres.react.inspect",
            schemaVersion: 1,
            complete: true,
            core: {
                schema: "valdres.inspect",
                schemaVersion: 4,
            },
            react: {
                coreRecordingId: recording.core.recordingId,
                totals: {
                    commitTimeGroups: 1,
                    profilerCallbacks: 1,
                    subscriberCallbacks: 2,
                    thrownSubscriberCallbacks: 0,
                    thrownSnapshots: 0,
                },
            },
        })
        expect(recording.react.summaries).toHaveLength(1)
        expect(profiler).toMatchObject({
            type: "react-profiler",
            phase: "update",
            capture: {
                recordingId: recording.core.recordingId,
                store: { kind: "scope" },
            },
        })
        expect("commitId" in (profiler?.capture ?? {})).toBe(false)
        expect(subscribers).toHaveLength(2)
        expect(subscribers.map(detail => detail.start.commitId)).toEqual(
            coreCommitIds,
        )
        expect(snapshots.some(snapshot => snapshot.snapshot === "client")).toBe(
            true,
        )
        const subscriberStackSnapshots = snapshots.filter(
            snapshot =>
                snapshot.snapshot === "client" &&
                snapshot.duringSubscriberCallback,
        )
        expect(subscriberStackSnapshots.length).toBeGreaterThan(0)
        expect(
            recording.react.totals.clientSnapshotsDuringSubscriberCallbacks,
        ).toBe(subscriberStackSnapshots.length)
        expect(Object.isFrozen(recording)).toBe(true)
        expect(Object.isFrozen(recording.react)).toBe(true)
        expect(Object.isFrozen(recording.react.summaries)).toBe(true)
        expect(Object.isFrozen(recording.react.details)).toBe(true)
        expect(recording.core).toEqual(core.inspect.export())
        assertJsonSafe(recording)
        expect(JSON.stringify(recording)).not.toContain(secret)
    })

    test("records separate Provider boundaries in one commitTime group", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const Counter = ({ label }: { readonly label: string }) => (
            <span data-testid={label}>{inspected.useValue(count)}</span>
        )
        const view = render(
            <>
                <inspected.Provider>
                    <Counter label="first" />
                </inspected.Provider>
                <inspected.Provider>
                    <Counter label="second" />
                </inspected.Provider>
            </>,
        )
        inspected.inspect.reset()

        act(() => core.store.set(count, 1))

        expect(view.getByTestId("first").textContent).toBe("1")
        expect(view.getByTestId("second").textContent).toBe("1")
        const { react } = inspected.inspect.export()
        expect(react.summaries).toHaveLength(2)
        expect(
            new Set(react.summaries.map(summary => summary.providerId)).size,
        ).toBe(2)
        expect(
            new Set(react.summaries.map(summary => summary.commitTimeGroupId))
                .size,
        ).toBe(1)
        expect(
            new Set(react.summaries.map(summary => summary.commitTimeUs)).size,
        ).toBe(1)
        expect(react.profiler.commitCallbacksObserved).toBe(true)
        expect(react.totals).toMatchObject({
            commitTimeGroups: 1,
            profilerCallbacks: 2,
            subscriberCallbacks: 2,
        })
        expect(
            new Set(react.summaries.map(summary => summary.capture.store.id))
                .size,
        ).toBe(1)
    })

    test("does not claim commitTime groups are unique React commits", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        const { result } = renderHook(() => inspected.useValue(count), {
            wrapper,
        })
        inspected.inspect.reset()
        const performanceTarget = globalThis.performance as Performance & {
            now: () => number
        }
        const ownDescriptor = Object.getOwnPropertyDescriptor(
            performanceTarget,
            "now",
        )

        try {
            Object.defineProperty(performanceTarget, "now", {
                configurable: true,
                value: () => 1_000,
            })
            act(() => core.store.set(count, 1))
            act(() => core.store.set(count, 2))
        } finally {
            if (ownDescriptor === undefined) {
                Reflect.deleteProperty(performanceTarget, "now")
            } else {
                Object.defineProperty(performanceTarget, "now", ownDescriptor)
            }
        }

        expect(result.current).toBe(2)
        const { react } = inspected.inspect.export()
        expect(react.totals.profilerCallbacks).toBe(2)
        expect(react.totals.commitTimeGroups).toBe(1)
        expect(
            new Set(react.summaries.map(summary => summary.commitTimeGroupId)),
        ).toEqual(new Set([1]))
    })

    test("groups nested Profiler boundaries into one commitTime group", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const Counter = () => <span>{inspected.useValue(count)}</span>
        const view = render(
            <inspected.Provider>
                <inspected.Provider>
                    <Counter />
                </inspected.Provider>
            </inspected.Provider>,
        )
        inspected.inspect.reset()

        act(() => core.store.set(count, 1))

        expect(view.container.textContent).toBe("1")
        const { react } = inspected.inspect.export()
        expect(react.summaries).toHaveLength(2)
        expect(
            new Set(react.summaries.map(summary => summary.commitTimeGroupId))
                .size,
        ).toBe(1)
        expect(
            new Set(react.summaries.map(summary => summary.commitTimeUs)).size,
        ).toBe(1)
        expect(react.totals).toMatchObject({
            commitTimeGroups: 1,
            profilerCallbacks: 2,
            subscriberCallbacks: 1,
        })
    })

    test("keeps layout-effect cascades as truthful independent timelines", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const Scene = () => {
            const value = inspected.useValue(count)
            useLayoutEffect(() => {
                if (value === 1) core.store.set(count, 2)
            }, [value])
            return <span>{value}</span>
        }
        const view = render(
            <inspected.Provider>
                <Scene />
            </inspected.Provider>,
        )
        inspected.inspect.reset()

        act(() => core.store.set(count, 1))

        expect(view.container.textContent).toBe("2")
        const recording = inspected.inspect.export()
        const subscribers = detailsOfType(recording, "react-subscriber")
        const coreCommitIds = recording.core.summaries
            .filter(summary => summary.type === "commit")
            .map(summary => summary.commitId)
        expect(subscribers.map(detail => detail.start.commitId)).toEqual(
            coreCommitIds,
        )
        expect(subscribers).toHaveLength(2)
        expect(
            recording.react.summaries.every(
                summary => !("commitId" in summary.capture),
            ),
        ).toBe(true)
        expect(recording.react.summaries.map(summary => summary.phase)).toEqual(
            ["update", "nested-update"],
        )
        const { react } = recording
        expect(react.totals).toMatchObject({
            profilerCallbacks: 2,
            subscriberCallbacks: 2,
        })
        expect(react.totals.commitTimeGroups).toBeGreaterThanOrEqual(1)
        expect(react.totals.commitTimeGroups).toBeLessThanOrEqual(2)
    })

    test("keeps exact totals when summary and detail rings overflow", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core, {
            capacity: { summaries: 1, details: 0 },
        })
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        renderHook(() => inspected.useValue(count), { wrapper })
        inspected.inspect.reset()

        for (const value of [1, 2, 3]) {
            act(() => core.store.set(count, value))
        }

        const { react, complete } = inspected.inspect.export()
        expect(react.summaries).toHaveLength(1)
        expect(react.details).toEqual([])
        expect(react.totals).toMatchObject({
            profilerCallbacks: 3,
            subscriberCallbacks: 3,
        })
        expect(react.totals.snapshots).toBeGreaterThanOrEqual(3)
        expect(react.overflow.summaries).toBe(2)
        expect(react.overflow.details).toBe(
            react.totals.subscriberCallbacks + react.totals.snapshots,
        )
        expect(react.overflow.retained.summaries).toEqual({
            firstSequence: react.summaries[0]?.sequence,
            lastSequence: react.summaries[0]?.sequence,
        })
        expect("details" in react.overflow.retained).toBe(false)
        expect(react.complete).toBe(false)
        expect(complete).toBe(false)
    })

    test("bounds a high-volume timeline while retaining exact event totals", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core, {
            capacity: { summaries: 1, details: 0 },
        })
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        const { result } = renderHook(() => inspected.useValue(count), {
            wrapper,
        })
        inspected.inspect.reset()

        act(() => {
            for (let value = 1; value <= 300; value++) {
                core.store.set(count, value)
            }
        })

        expect(result.current).toBe(300)
        const { react } = inspected.inspect.export()
        expect(react.totals).toMatchObject({
            profilerCallbacks: 1,
            subscriberCallbacks: 300,
        })
        expect(react.summaries).toHaveLength(1)
        expect(react.details).toEqual([])
        expect(react.overflow.details).toBe(
            react.totals.subscriberCallbacks + react.totals.snapshots,
        )
        expect(react.complete).toBe(false)
    })

    test("records server snapshots without fabricating a React commit", () => {
        const count = atom(7, { name: "ssr-count" })
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const Counter = (): ReactElement => (
            <span>{inspected.useValue(count)}</span>
        )

        const html = renderToString(
            <inspected.Provider>
                <Counter />
            </inspected.Provider>,
        )
        const recording = inspected.inspect.export()
        const snapshots = detailsOfType(recording, "react-snapshot")

        expect(html).toContain(">7</span>")
        expect(recording.react.summaries).toEqual([])
        expect(recording.react.totals.commitTimeGroups).toBe(0)
        expect(recording.react.totals.profilerCallbacks).toBe(0)
        expect(recording.react.totals.serverSnapshots).toBe(1)
        expect(recording.react.totals.clientSnapshots).toBe(0)
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]).toMatchObject({
            snapshot: "server",
            cached: false,
            result: "returned",
            start: {
                state: { kind: "atom", name: "ssr-count" },
            },
        })
        expect("duringSubscriberCallback" in (snapshots[0] ?? {})).toBe(false)
    })

    test("records thrown snapshots without retaining the thrown error", () => {
        const secret = "private-selector-error"
        const thrown = new Error(secret)
        const broken = selector(
            () => {
                throw thrown
            },
            { name: "broken" },
        )
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const Broken = (): ReactElement | null => {
            inspected.useValue(broken)
            return null
        }

        const received = thrownBy(() =>
            renderToString(
                <inspected.Provider>
                    <Broken />
                </inspected.Provider>,
            ),
        )
        const recording = inspected.inspect.export()
        const snapshots = detailsOfType(recording, "react-snapshot")

        expect(received).not.toBe(thrown)
        expect(received).toMatchObject({
            name: "SelectorGetterError",
            code: "VALDRES_SELECTOR_GETTER_ERROR",
        })
        expect(recording.react.totals.thrownSnapshots).toBe(1)
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]).toMatchObject({
            type: "react-snapshot",
            snapshot: "server",
            result: "threw",
        })
        expect(JSON.stringify(recording)).not.toContain(secret)
    })

    test("records a thrown client snapshot without changing React recovery", () => {
        const secret = "private-client-selector-error"
        const broken = selector(
            () => {
                throw new Error(secret)
            },
            { name: "client-broken" },
        )
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const Broken = (): ReactElement | null => {
            inspected.useValue(broken)
            return null
        }

        const view = (() => {
            const consoleError = spyOn(console, "error").mockImplementation(
                () => undefined,
            )
            try {
                return render(
                    <inspected.Provider>
                        <ErrorBoundary>
                            <Broken />
                        </ErrorBoundary>
                    </inspected.Provider>,
                )
            } finally {
                consoleError.mockRestore()
            }
        })()
        const recording = inspected.inspect.export()
        const snapshots = detailsOfType(recording, "react-snapshot")

        expect(view.getByText("failed")).toBeTruthy()
        expect(recording.react.totals.clientSnapshots).toBeGreaterThan(0)
        expect(recording.react.totals.thrownSnapshots).toBeGreaterThan(0)
        expect(snapshots).not.toHaveLength(0)
        expect(
            snapshots.every(
                snapshot =>
                    snapshot.snapshot === "client" &&
                    snapshot.result === "threw",
            ),
        ).toBe(true)
        expect(JSON.stringify(recording)).not.toContain(secret)
    })

    test("starts a new React boundary after coordinated or external reset", () => {
        const count = atom(0)
        const core = createInspectableStore()
        const inspected = createInspectableReact(core)
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        renderHook(() => inspected.useValue(count), { wrapper })

        const firstReactId = inspected.inspect.recordingId
        const firstCoreId = core.inspect.recordingId
        inspected.inspect.reset()
        expect(inspected.inspect.recordingId).not.toBe(firstReactId)
        expect(core.inspect.recordingId).not.toBe(firstCoreId)
        expect(inspected.inspect.export().react).toMatchObject({
            coreRecordingId: core.inspect.recordingId,
            summaries: [],
            details: [],
        })

        act(() => core.store.set(count, 1))
        const beforeExternalReset = inspected.inspect.recordingId
        core.inspect.reset()
        const recording = inspected.inspect.export()

        expect(recording.react.recordingId).not.toBe(beforeExternalReset)
        expect(recording.react.coreRecordingId).toBe(recording.core.recordingId)
        expect(recording.react.summaries).toEqual([])
        expect(recording.react.details).toEqual([])
        expect(recording.react.totals.commitTimeGroups).toBe(0)
        expect(recording.react.totals.profilerCallbacks).toBe(0)
    })

    test("faults the React recorder without changing Store or React behavior", () => {
        const count = atom(0)
        const primary = createInspectableStore()
        const incompatible = createInspectableStore()
        const mutableCore: {
            store: Store
            inspect: typeof primary.inspect
        } = {
            store: primary.store,
            inspect: primary.inspect,
        }
        const inspected = createInspectableReact(mutableCore)
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <inspected.Provider>{children}</inspected.Provider>
        )
        const { result } = renderHook(() => inspected.useValue(count), {
            wrapper,
        })
        inspected.inspect.reset()

        act(() => {
            mutableCore.inspect = incompatible.inspect
            try {
                primary.store.set(count, 1)
            } finally {
                mutableCore.inspect = primary.inspect
            }
        })

        expect(result.current).toBe(1)
        const recording = inspected.inspect.export()
        expect(primary.store.get(count)).toBe(1)
        expect(recording.react.complete).toBe(false)
        expect(recording.react.fault).toMatchObject({
            type: "recorder-fault",
            phase: "capture",
        })
        expect(recording.react.summaries).toEqual([])
        expect(recording.react.details).toEqual([])
    })
})
