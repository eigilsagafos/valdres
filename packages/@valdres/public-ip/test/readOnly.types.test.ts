/**
 * Compile-time contracts: the state is read-only and the network operations
 * return promises of plain values. The `@ts-expect-error` directives fail
 * `bun run typecheck:tests` if a future change makes any export writable or
 * loosens an operation's signature.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    fetchPublicIp,
    publicIpAtom,
    publicIpErrorAtom,
    publicIpStatusAtom,
    publicIpV4Atom,
    publicIpV6ValueAtom,
    publicIpValueAtom,
    requestPublicIp,
    type PublicIpError,
    type PublicIpFamily,
    type PublicIpRequestOptions,
    type PublicIpState,
    type PublicIpStatus,
} from "../src/index"

const rejectedWrites = (app: Store, state: PublicIpState) => {
    // @ts-expect-error an external atom cannot be written
    app.set(publicIpAtom, app.get(publicIpAtom))
    // @ts-expect-error a selector cannot be written
    app.set(publicIpValueAtom, "203.0.113.7")
    // @ts-expect-error an external atom cannot be reset
    app.reset(publicIpV4Atom)
    // @ts-expect-error snapshots are read-only
    state.ip = "203.0.113.7"
    // @ts-expect-error the family is a closed set
    void requestPublicIp({ family: "v5" })
    // @ts-expect-error endpoints are a list
    void requestPublicIp({ endpoints: "https://ip.test" })
    // @ts-expect-error requests are not tied to a Store
    void requestPublicIp(app)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const state: ExternalAtom<PublicIpState> = publicIpAtom
    const value: Selector<string | null> = publicIpValueAtom
    const v6: Selector<string | null> = publicIpV6ValueAtom
    const status: Selector<PublicIpStatus> = publicIpStatusAtom
    const error: Selector<PublicIpError | null> = publicIpErrorAtom
    const family: PublicIpFamily = "v4"
    const options: PublicIpRequestOptions = {
        family,
        endpoints: ["https://ip.test"],
        timeoutMs: 1,
        fresh: true,
        signal: new AbortController().signal,
    }
    const request: (options?: PublicIpRequestOptions) => Promise<string> =
        requestPublicIp
    const lookup: (options?: PublicIpRequestOptions) => Promise<string> =
        fetchPublicIp
    expect(app.get(state).status).toBe(app.get(status))
    expect([app.get(value), app.get(v6), app.get(error)]).toEqual([
        null,
        null,
        null,
    ])
    expect([
        typeof request,
        typeof lookup,
        typeof rejectedWrites,
        options.family,
    ]).toEqual(["function", "function", "function", "v4"])
    app.dispose()
})
