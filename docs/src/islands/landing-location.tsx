import { useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import {
    positionAtom,
    permissionAtom,
    geolocationErrorAtom,
    geolocationStatusAtom,
} from "@valdres/browser-geolocation"
import { docsStore } from "./shared-store"

function PinIcon() {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    )
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
function compassDirection(heading: number) {
    return COMPASS_POINTS[Math.round(heading / 45) % 8]
}

function PositionView() {
    const position = useValue(positionAtom)
    const error = useValue(geolocationErrorAtom)
    const status = useValue(geolocationStatusAtom)

    if (error) {
        return (
            <div className="text-[10px] text-rose-500 text-center px-2 leading-tight">
                {error.code === 1
                    ? "Permission denied"
                    : error.code === 2
                      ? "Position unavailable (HTTPS required on iOS)"
                      : error.message || "Geolocation error"}
            </div>
        )
    }
    if (!position) {
        return (
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {status === "pending" || status === "idle"
                    ? "Locating…"
                    : status}
            </div>
        )
    }
    const { latitude, longitude, accuracy, altitude, heading, speed } =
        position
    return (
        <div className="font-mono text-[11px] leading-tight text-zinc-700 dark:text-zinc-200 text-center">
            <div>{latitude.toFixed(4)}°</div>
            <div>{longitude.toFixed(4)}°</div>
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1">
                ±{Math.round(accuracy)}m
            </div>
            {(altitude !== null || speed !== null || heading !== null) && (
                <div className="flex items-center justify-center gap-2 mt-1.5 text-[9px] text-zinc-500 dark:text-zinc-400">
                    {altitude !== null && (
                        <span>↕ {Math.round(altitude)}m</span>
                    )}
                    {speed !== null && (
                        <span>→ {(speed * 3.6).toFixed(1)} km/h</span>
                    )}
                    {heading !== null && (
                        <span>
                            ↗ {compassDirection(heading)}{" "}
                            {Math.round(heading)}°
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

function LocationDemo() {
    const permission = useValue(permissionAtom)
    const [active, setActive] = useState(false)

    if (permission === "denied") {
        return (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-rose-500">
                <PinIcon />
                <div className="text-[10px] font-semibold uppercase tracking-wider">
                    Permission denied
                </div>
            </div>
        )
    }

    if (permission === "unsupported") {
        return (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-zinc-400 dark:text-zinc-500">
                <PinIcon />
                <div className="text-[10px] font-semibold uppercase tracking-wider">
                    Unsupported
                </div>
            </div>
        )
    }

    if (active || permission === "granted") {
        return (
            <div className="flex flex-col items-center justify-center gap-1.5 w-full h-full text-emerald-500">
                <PinIcon />
                <PositionView />
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
            <button
                onClick={() => setActive(true)}
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:border-accent-500 hover:text-accent-500 transition-colors"
            >
                <PinIcon />
                Show location
            </button>
        </div>
    )
}

export function mountLocationDemo(el: HTMLElement) {
    createRoot(el).render(
        <Provider store={docsStore}>
            <LocationDemo />
        </Provider>,
    )
}
