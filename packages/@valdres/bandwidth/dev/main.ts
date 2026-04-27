import { store } from "valdres"
import {
    downloadSpeedAtom,
    uploadSpeedAtom,
    latencyAtom,
    jitterAtom,
    measurementStatusAtom,
    measureBandwidth,
    invalidateOnAtom,
} from "../src/index"
import { publicIpAtom } from "@valdres/public-ip"
import type { MeasurementStatus } from "../types/MeasurementStatus"

const s = store()

const el = (id: string) => document.getElementById(id) as HTMLElement

const statusLabels: Record<MeasurementStatus, string> = {
    idle: "Idle",
    "measuring-latency": "Measuring latency…",
    "measuring-download": "Measuring download…",
    "measuring-upload": "Measuring upload…",
    complete: "Complete",
    error: "Error",
}

const statusClass = (status: MeasurementStatus): string => {
    if (status === "complete") return "complete"
    if (status === "error") return "error"
    if (status === "idle") return ""
    return "active"
}

const activeStat = (status: MeasurementStatus): string | null => {
    if (status === "measuring-latency") return "latency"
    if (status === "measuring-download") return "download"
    if (status === "measuring-upload") return "upload"
    return null
}

const format = (value: unknown, decimals = 1): string => {
    if (typeof value !== "number" || !isFinite(value)) return "—"
    if (value >= 100) return value.toFixed(0)
    if (value >= 10) return value.toFixed(1)
    return value.toFixed(decimals)
}

let frame = 0
const render = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
        frame = 0
        const status = s.get(measurementStatusAtom)
        const statusEl = el("status")
        statusEl.className = `status ${statusClass(status)}`.trim()
        el("status-label").textContent = statusLabels[status]

        el("download").textContent = format(s.get(downloadSpeedAtom))
        el("upload").textContent = format(s.get(uploadSpeedAtom))
        el("latency").textContent = format(s.get(latencyAtom))
        el("jitter").textContent = format(s.get(jitterAtom))

        const active = activeStat(status)
        for (const key of ["download", "upload", "latency", "jitter"]) {
            const card = document.querySelector(
                `[data-stat="${key}"]`,
            ) as HTMLElement | null
            if (!card) continue
            card.classList.toggle(
                "active",
                key === active ||
                    (active === "latency" && key === "jitter"),
            )
        }

        const btn = el("refresh") as HTMLButtonElement
        btn.disabled = status.startsWith("measuring-")
        btn.textContent = status.startsWith("measuring-")
            ? "Measuring…"
            : "Run again"
    })
}

s.sub(measurementStatusAtom, render)
s.sub(downloadSpeedAtom, render)
s.sub(uploadSpeedAtom, render)
s.sub(latencyAtom, render)
s.sub(jitterAtom, render)

render()

// Lazy-trigger: reading any value atom kicks off the measurement.
s.get(downloadSpeedAtom)

el("refresh").addEventListener("click", () => {
    measureBandwidth({ fresh: true }).catch(err => {
        console.error("measurement failed:", err)
    })
})

const ipMeta = el("ip-meta")
let ipUnsub: (() => void) | null = null

const renderIp = () => {
    const ip = s.get(publicIpAtom)
    ipMeta.textContent = typeof ip === "string" && ip ? ip : "…"
}

const watchIp = el("watch-ip") as HTMLInputElement
watchIp.addEventListener("change", () => {
    ipUnsub?.()
    ipUnsub = null
    if (watchIp.checked) {
        invalidateOnAtom.setSelf([publicIpAtom])
        ipUnsub = s.sub(publicIpAtom, renderIp)
        renderIp()
    } else {
        invalidateOnAtom.setSelf([])
        ipMeta.textContent = "—"
    }
})
