import type { ExternalSource } from "valdres"
import type { PublicIpFamily } from "../types/PublicIpFamily"
import type { PublicIpState } from "../types/PublicIpState"
import { readPublicIp, retainPublicIp } from "./publicIpRecord"
import { IDLE_STATE } from "./states"

/**
 * Reading samples the shared record; subscribing only registers for its
 * publications. Neither ever requests anything. A server render reads the
 * fixed idle seed, so hydration matches whatever the server rendered.
 */
export const publicIpSource = (
    family: PublicIpFamily,
): ExternalSource<PublicIpState> => ({
    getSnapshot: () => readPublicIp(family),
    getServerSnapshot: () => IDLE_STATE,
    subscribe: invalidate => retainPublicIp(family, invalidate),
})
