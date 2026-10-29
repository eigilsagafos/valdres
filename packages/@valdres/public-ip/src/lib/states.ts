import type { PublicIpError } from "../types/PublicIpError"
import type { PublicIpState } from "../types/PublicIpState"

const fixed = (status: PublicIpState["status"]): PublicIpState =>
    Object.freeze({ status, ip: null, updatedAt: null, error: null })

export const UNSUPPORTED_STATE = fixed("unsupported")
export const IDLE_STATE = fixed("idle")

/** Pending keeps the last address; the previous error is over. */
export const pendingFrom = (settled: PublicIpState): PublicIpState =>
    Object.freeze({
        status: "pending",
        ip: settled.ip,
        updatedAt: settled.updatedAt,
        error: null,
    })

export const readyState = (ip: string, updatedAt: number): PublicIpState =>
    Object.freeze({ status: "ready", ip, updatedAt, error: null })

const describe = (error: unknown): PublicIpError => {
    const name = String((error as { name?: unknown } | null)?.name ?? "Error")
    const message = String(
        (error as { message?: unknown } | null)?.message ?? error,
    )
    const causes = (error as { errors?: unknown } | null)?.errors
    if (!Array.isArray(causes) || causes.length === 0)
        return Object.freeze({ name, message })
    const detail = causes
        .map(cause =>
            String((cause as { message?: unknown } | null)?.message ?? cause),
        )
        .join("; ")
    return Object.freeze({ name, message: `${message}: ${detail}` })
}

/** A failed refresh keeps the last address next to the new error. */
export const errorFrom = (
    settled: PublicIpState,
    error: unknown,
): PublicIpState =>
    Object.freeze({
        status: "error",
        ip: settled.ip,
        updatedAt: settled.updatedAt,
        error: describe(error),
    })
