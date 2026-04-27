import { useState, useRef, useCallback, useEffect } from "react"
import { atom, store, cacheMeta } from "valdres"
import { Slider } from "../../components/ui/slider"
import { WorldMap } from "./world-map"

export function CacheDemo() {
    const [maxAgeMs, setMaxAgeMs] = useState(1000)
    const [swrMs, setSwrMs] = useState(5000)
    const [sieMs, setSieMs] = useState(10000)
    const [failMode, setFailMode] = useState(false)
    const [status, setStatus] = useState<"idle" | "fresh" | "stale" | "loading" | "error">("idle")
    const [isRevalidating, setIsRevalidating] = useState(false)
    const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null)
    const [running, setRunning] = useState(false)
    const [globeKey, setGlobeKey] = useState(0)

    const unsubsRef = useRef<(() => void)[]>([])
    const storeRef = useRef(store())
    const failModeRef = useRef(failMode)

    const maxAgeAtomRef = useRef(atom(1000))
    const swrAtomRef = useRef(atom(5000))
    const sieAtomRef = useRef(atom(10000))

    failModeRef.current = failMode

    const cleanup = useCallback(() => {
        for (const unsub of unsubsRef.current) unsub()
        unsubsRef.current = []
    }, [])

    const start = useCallback(() => {
        cleanup()
        const s = store()
        storeRef.current = s
        setStatus("loading")
        setIsRevalidating(false)
        setPosition(null)
        setRunning(true)
        setGlobeKey(k => k + 1)

        const maxAgeAtom = atom(maxAgeMs)
        const swrAtom = atom(swrMs)
        const sieAtom = atom(sieMs)
        maxAgeAtomRef.current = maxAgeAtom
        swrAtomRef.current = swrAtom
        sieAtomRef.current = sieAtom

        const issAtom = atom(
            async () => {
                if (failModeRef.current) {
                    throw new Error("503 Service Unavailable")
                }
                const res = await fetch("http://api.open-notify.org/iss-now.json")
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
                const data = await res.json()
                return data.iss_position as { latitude: string; longitude: string }
            },
            {
                maxAge: maxAgeAtom,
                staleWhileRevalidate: swrAtom,
                staleIfError: sieAtom,
            },
        )

        const handleValue = (val: unknown) => {
            if (val && typeof val === "object" && "then" in val) {
                ;(val as Promise<any>).then(
                    resolved => {
                        setStatus("fresh")
                        setPosition({ lat: Number(resolved.latitude), lon: Number(resolved.longitude) })
                    },
                    err => {
                        setStatus("error")
                    },
                )
            } else if (val && typeof val === "object" && "latitude" in (val as any)) {
                const v = val as { latitude: string; longitude: string }
                setStatus("fresh")
                setPosition({ lat: Number(v.latitude), lon: Number(v.longitude) })
            }
        }

        unsubsRef.current.push(
            s.sub(issAtom, () => handleValue(s.get(issAtom))),
        )

        const meta = cacheMeta(issAtom)
        unsubsRef.current.push(
            s.sub(meta, () => {
                const m = s.get(meta)
                if (m) setIsRevalidating(m.isRevalidating)
            }),
        )

        handleValue(s.get(issAtom))
    }, [maxAgeMs, swrMs, sieMs, cleanup])

    const reset = useCallback(() => {
        cleanup()
        storeRef.current = store()
        setStatus("idle")
        setIsRevalidating(false)
        setPosition(null)
        setRunning(false)
    }, [cleanup])

    const updateMaxAge = useCallback((v: number) => {
        setMaxAgeMs(v)
        if (running) storeRef.current.set(maxAgeAtomRef.current, v)
    }, [running])

    const updateSwr = useCallback((v: number) => {
        setSwrMs(v)
        if (running) storeRef.current.set(swrAtomRef.current, v)
    }, [running])

    const updateSie = useCallback((v: number) => {
        setSieMs(v)
        if (running) storeRef.current.set(sieAtomRef.current, v)
    }, [running])

    useEffect(() => () => cleanup(), [cleanup])

    const statusColors = { fresh: "#22c55e", stale: "#f59e0b", loading: "#3b82f6", error: "#ef4444", idle: "oklch(0.5 0 0 / 0.2)" }
    const statusLabels = { fresh: "Fresh", stale: "Serving stale", loading: "Loading...", error: "Error", idle: "Stopped" }

    return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
            <div className="flex items-center mb-4">
                <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    ISS Position Tracker
                </div>
                <div className="ml-auto flex gap-2">
                    {running && (
                        <button
                            onClick={reset}
                            className="px-3 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm font-medium cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        onClick={start}
                        className="px-3 py-1 rounded-md border border-accent-500/30 bg-accent-500/10 text-sm font-medium cursor-pointer hover:bg-accent-500/20 transition-colors"
                    >
                        {running ? "Restart" : "Start"}
                    </button>
                </div>
            </div>

            {/* Globe */}
            {running && (
                <div className="mb-4 rounded-lg overflow-hidden">
                    <WorldMap key={globeKey} lat={position?.lat} lon={position?.lon} />
                </div>
            )}

            {/* Status row */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: statusColors[status] }}
                />
                <span className="text-sm font-medium">{statusLabels[status]}</span>
                {isRevalidating && (
                    <span className="text-xs text-blue-500 font-medium">Revalidating...</span>
                )}
                {position && (
                    <code className="text-xs font-mono bg-zinc-200/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded">
                        {position.lat.toFixed(4)}°, {position.lon.toFixed(4)}°
                    </code>
                )}
            </div>

            {/* Sliders */}
            <div className="space-y-4 mb-4">
                <SliderRow label="maxAge" value={maxAgeMs} min={1000} max={5000} step={100} onChange={updateMaxAge} />
                <SliderRow label="staleWhileRevalidate" value={swrMs} min={0} max={15000} step={100} onChange={updateSwr} />
                <SliderRow label="staleIfError" value={sieMs} min={0} max={20000} step={100} onChange={updateSie} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={failMode}
                    onChange={e => setFailMode(e.target.checked)}
                    className="accent-accent-500 w-4 h-4 cursor-pointer"
                />
                Simulate API errors
            </label>
        </div>
    )
}

function SliderRow({ label, value, min, max, step, onChange }: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (v: number) => void
}) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-mono min-w-[200px] text-zinc-600 dark:text-zinc-400">{label}</span>
            <Slider
                value={[value]}
                min={min}
                max={max}
                step={step}
                onValueChange={([v]) => onChange(v)}
                className="flex-1"
            />
            <span className="text-xs font-mono min-w-[50px] text-right text-accent-500 font-semibold tabular-nums">
                {value}ms
            </span>
        </div>
    )
}
