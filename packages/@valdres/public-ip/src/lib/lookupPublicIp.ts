import type { CancelSignal } from "../types/CancelSignal"
import type { PublicIpFamily } from "../types/PublicIpFamily"
import { timeoutError } from "./domErrors"
import { isValidIp } from "./isValidIp"
import { isValidIpV4 } from "./isValidIpV4"
import { isValidIpV6 } from "./isValidIpV6"
import type { NormalizedOptions } from "./normalizeOptions"

const VALIDATE: Record<PublicIpFamily, (value: string) => boolean> = {
    any: isValidIp,
    v4: isValidIpV4,
    v6: isValidIpV6,
}
const EXPECTED: Record<PublicIpFamily, string> = {
    any: "an IP address",
    v4: "an IPv4 address",
    v6: "an IPv6 address",
}
/** The longest textual IPv6 address is 45 characters. */
const MAX_ADDRESS_LENGTH = 45

/**
 * Asks each endpoint in turn, with a per-endpoint timeout, and resolves the
 * first trimmed body that is an address of the requested family. Rejects with
 * an `AggregateError` of every endpoint's failure, or with `signal.reason` as
 * soon as `signal` aborts. Requests send no credentials and no referrer and
 * bypass the HTTP cache. Stateless: publishes nothing.
 */
export const lookupPublicIp = async (
    { family, endpoints, timeoutMs }: NormalizedOptions,
    signal: CancelSignal | undefined,
): Promise<string> => {
    const failures: unknown[] = []
    for (const endpoint of endpoints) {
        if (signal?.aborted) throw signal.reason
        const controller = new AbortController()
        const forward = () => controller.abort(signal!.reason)
        signal?.addEventListener("abort", forward, { once: true })
        const timer = setTimeout(
            () =>
                controller.abort(
                    timeoutError(`${endpoint} timed out after ${timeoutMs} ms`),
                ),
            timeoutMs,
        )
        try {
            const response = await fetch(endpoint, {
                signal: controller.signal,
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
            })
            if (!response.ok) {
                failures.push(
                    new Error(`${endpoint} responded ${response.status}`),
                )
                continue
            }
            const body = (await response.text()).trim()
            if (signal?.aborted) throw signal.reason
            if (body.length > MAX_ADDRESS_LENGTH || !VALIDATE[family](body)) {
                failures.push(
                    new Error(`${endpoint} did not return ${EXPECTED[family]}`),
                )
                continue
            }
            return body
        } catch (error) {
            if (signal?.aborted) throw signal.reason
            failures.push(
                controller.signal.aborted ? controller.signal.reason : error,
            )
        } finally {
            clearTimeout(timer)
            signal?.removeEventListener("abort", forward)
        }
    }
    throw new AggregateError(failures, "Every public IP endpoint failed")
}
