import { store } from "valdres"
import {
    bandwidthAtom,
    measureBandwidth,
    type BandwidthState,
} from "../src/index"

const s = store()

const el = (id: string) => document.getElementById(id) as HTMLElement

const label = ({ status, phase }: BandwidthState): string => {
    if (status === "pending") return `Measuring ${phase}…`
    return {
        unsupported: "Unsupported",
        idle: "Idle",
        ready: "Complete",
        error: "Error",
    }[status]
}

const format = (value: number | null | undefined, decimals = 1): string => {
    if (typeof value !== "number" || !isFinite(value)) return "—"
    if (value >= 100) return value.toFixed(0)
    if (value >= 10) return value.toFixed(1)
    return value.toFixed(decimals)
}

let controller: AbortController | null = null

const render = () => {
    const state = s.get(bandwidthAtom)
    const statusEl = el("status")
    statusEl.className =
        `status ${state.status === "ready" ? "complete" : state.status === "error" ? "error" : state.status === "pending" ? "active" : ""}`.trim()
    el("status-label").textContent =
        state.status === "error"
            ? `Error: ${state.error!.message}`
            : label(state)
    // While running, show the provisional readings; otherwise the last result.
    const shown = state.status === "pending" ? state.progress : state.result
    el("download").textContent = format(shown?.downloadMbps)
    el("upload").textContent = format(shown?.uploadMbps)
    el("latency").textContent = format(shown?.latencyMs)
    el("jitter").textContent = format(shown?.jitterMs)
    for (const key of ["download", "upload", "latency", "jitter"]) {
        const active =
            state.phase === key ||
            (state.phase === "latency" && key === "jitter")
        document
            .querySelector(`[data-stat="${key}"]`)
            ?.classList.toggle("active", active)
    }
    const running = state.status === "pending"
    const button = el("refresh") as HTMLButtonElement
    button.disabled = running
    button.textContent = running
        ? "Measuring…"
        : state.result === null
          ? "Run measurement"
          : "Run again"
    ;(el("cancel") as HTMLButtonElement).disabled = !running
}

s.sub(bandwidthAtom, render)
render()

el("refresh").addEventListener("click", () => {
    controller = new AbortController()
    measureBandwidth({ signal: controller.signal }).catch(error => {
        if ((error as Error).name !== "AbortError")
            console.error("measurement failed:", error)
    })
})
el("cancel").addEventListener("click", () => controller?.abort())
