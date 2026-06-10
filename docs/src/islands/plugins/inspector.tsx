// Generic live "atom inspector" for plugin demo widgets. Given a list of
// atoms/selectors, it subscribes to each and renders the live value, updating
// in real time as the underlying browser API changes. Reused across most
// @valdres/browser-* plugin pages so every plugin can show a working demo with
// minimal per-plugin code.
import {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react"
import { createRoot } from "react-dom/client"
import { Provider, useStore } from "valdres-react"
import { isPromiseLike } from "valdres"
import { docsStore } from "../shared-store"

export type InspectorRow = {
    /** Display label — usually the export name. */
    label: string
    /** A valdres atom or selector to read live. */
    state: unknown
    /** Optional formatter for the value. */
    format?: (value: any) => ReactNode
}

export type InspectorConfig = {
    rows: InspectorRow[]
    /** A short instruction, e.g. "Resize the window". */
    hint?: string
    /**
     * For permission-gated APIs (geolocation, device sensors): render a button
     * first and only subscribe the rows after the user clicks — so the page
     * never prompts on load. `request` runs an explicit permission call where
     * one exists; for APIs that prompt on subscribe (geolocation) it can be
     * omitted.
     */
    gated?: { buttonLabel: string; request?: () => void | Promise<unknown> }
    /**
     * An action button shown next to the live rows once started, e.g.
     * "Re-measure" → invalidateMeasurement(). Fired without awaiting; the rows
     * reflect whatever it changes.
     */
    action?: { label: string; run: () => void | Promise<unknown> }
    /**
     * A timestamped history of an atom/selector's changes. Useful when the
     * interesting moment happens while you're not looking at the page — e.g.
     * visibility flips exactly when you switch tabs.
     */
    log?: { state: unknown; label?: string; format?: (value: any) => ReactNode }
}

function defaultFormat(value: any): ReactNode {
    if (value === null || value === undefined)
        return <span className="text-zinc-400 dark:text-zinc-500">null</span>
    if (typeof value === "boolean")
        return (
            <span
                className={
                    value
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-500 dark:text-zinc-400"
                }
            >
                {String(value)}
            </span>
        )
    if (typeof value === "number")
        return Number.isInteger(value) ? String(value) : value.toFixed(2)
    if (typeof value === "object")
        return (
            <span className="break-all">{JSON.stringify(value)}</span>
        )
    return String(value)
}

function RowValue({ state, format }: Omit<InspectorRow, "label">) {
    const store = useStore()
    // Read without suspending: useValue would throw an async atom's pending
    // promise to React and not re-render until it resolves, hiding the live
    // setSelf() updates a measurement emits while running. Subscribing to the
    // store instead surfaces every intermediate value; a still-pending promise
    // just shows "…".
    const value = useSyncExternalStore(
        cb => store.sub(state as any, cb),
        () => store.get(state as any),
        () => store.get(state as any),
    )
    if (isPromiseLike(value)) {
        return <span className="text-zinc-400 dark:text-zinc-500">…</span>
    }
    return <>{(format ?? defaultFormat)(value)}</>
}

function Row({ label, state, format }: InspectorRow) {
    return (
        <div className="flex items-start justify-between gap-6 py-2 border-b border-border dark:border-border-dark last:border-0">
            <code className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                {label}
            </code>
            <div className="text-sm font-mono tabular-nums text-right min-w-0">
                <RowValue state={state} format={format} />
            </div>
        </div>
    )
}

function Rows({ rows }: { rows: InspectorRow[] }) {
    return (
        <div className="rounded-lg border border-border dark:border-border-dark bg-surface-sunken dark:bg-surface-raised-dark px-4 py-1">
            {rows.map(row => (
                <Row key={row.label} {...row} />
            ))}
        </div>
    )
}

function EventLog({
    state,
    label,
    format,
}: NonNullable<InspectorConfig["log"]>) {
    const store = useStore()
    const nextId = useRef(0)
    const [entries, setEntries] = useState<
        { id: number; time: string; value: unknown }[]
    >([])

    useEffect(() => {
        const add = (value: unknown) => {
            if (isPromiseLike(value)) return
            setEntries(prev =>
                [
                    { id: nextId.current++, time: new Date().toLocaleTimeString(), value },
                    ...prev,
                ].slice(0, 8),
            )
        }
        add(store.get(state as any))
        return store.sub(state as any, () => add(store.get(state as any)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                {label ?? "Log"}
            </div>
            <div className="rounded-lg border border-border dark:border-border-dark bg-surface-sunken dark:bg-surface-raised-dark divide-y divide-border dark:divide-border-dark max-h-40 overflow-auto">
                {entries.map(entry => (
                    <div
                        key={entry.id}
                        className="flex items-center justify-between gap-4 px-4 py-1.5 text-xs font-mono"
                    >
                        <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">
                            {entry.time}
                        </span>
                        <span>{(format ?? defaultFormat)(entry.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function Inspector({ config }: { config: InspectorConfig }) {
    const [started, setStarted] = useState(!config.gated)
    return (
        <div className="not-prose my-6">
            <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />
                    Live
                </span>
                {config.hint && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {config.hint}
                    </span>
                )}
                {started && config.action && (
                    <button
                        onClick={() =>
                            Promise.resolve(config.action!.run()).catch(() => {})
                        }
                        className="ml-auto shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:border-accent-500 hover:text-accent-500 transition-colors"
                    >
                        {config.action.label}
                    </button>
                )}
            </div>
            {started ? (
                <>
                    <Rows rows={config.rows} />
                    {config.log && <EventLog {...config.log} />}
                </>
            ) : (
                <button
                    onClick={() => {
                        // Render the rows immediately, then kick off the request
                        // (measurement/permission) — don't await it, or nothing
                        // shows until it finishes. Rows read the store directly,
                        // so live setSelf() updates appear as they happen.
                        setStarted(true)
                        Promise.resolve(config.gated?.request?.()).catch(() => {})
                    }}
                    className="text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:border-accent-500 hover:text-accent-500 transition-colors"
                >
                    {config.gated?.buttonLabel ?? "Start"}
                </button>
            )}
        </div>
    )
}

/** Build a mount function for the plugin-demo registry from a declarative config. */
export function inspector(config: InspectorConfig) {
    return (el: HTMLElement) => {
        el.innerHTML = ""
        createRoot(el).render(
            <Provider store={docsStore}>
                <Inspector config={config} />
            </Provider>,
        )
    }
}
