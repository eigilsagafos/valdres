import type { PublicIpRequestConfig } from "../types/PublicIpRequestConfig"

/**
 * The rejection of a `requestPublicIp` call made while a request of the same
 * family is in flight with a different effective configuration (endpoints or
 * timeout). Calls share a request only when their configurations match; a
 * conflicting call is never silently given another call's request, and the
 * in-flight request and its state are left alone. Wait for it, cancel it, or
 * pass `fresh: true` to replace it.
 */
export class PublicIpRequestConflictError extends Error {
    readonly code = "VALDRES_PUBLIC_IP_REQUEST_CONFLICT"
    readonly active: PublicIpRequestConfig
    readonly requested: PublicIpRequestConfig
    constructor(
        active: PublicIpRequestConfig,
        requested: PublicIpRequestConfig,
    ) {
        super(
            `A ${active.family} public IP request is already in flight with ${JSON.stringify({ endpoints: active.endpoints, timeoutMs: active.timeoutMs })}; ` +
                `it cannot be shared by a request with ${JSON.stringify({ endpoints: requested.endpoints, timeoutMs: requested.timeoutMs })}. ` +
                "Wait for it, cancel it, or pass fresh: true to replace it.",
        )
        this.name = "PublicIpRequestConflictError"
        this.active = active
        this.requested = requested
    }
}
