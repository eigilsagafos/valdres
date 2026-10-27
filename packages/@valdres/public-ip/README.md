<!-- DOCS:START -->

# public-ip

Looks up this page's public IP address from HTTP endpoints when you ask, and
publishes the outcome as read-only state: status, address, when it was received
and why the last request failed — one coherent snapshot per address family.

> **Requests only when you call one**
>
>
> Importing, reading, subscribing and server rendering never contact anything.
> Only `requestPublicIp()` (and the stateless `fetchPublicIp()`)
> send a request, and every endpoint asked learns the caller's IP address.

## Install

```bash
bun add @valdres/public-ip
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/public-ip](https://valdres.dev/react/plugins/public-ip)

## Usage

```ts
import { store } from "valdres"
import { publicIpAtom, requestPublicIp } from "@valdres/public-ip"

const app = store()
const stop = app.sub(publicIpAtom, () => {
    const { status, ip, error } = app.get(publicIpAtom)
    render(status === "error" ? error!.message : ip ?? "…")
})

button.addEventListener("click", () => {
    requestPublicIp().catch(() => {}) // the state records the failure
})
```

```tsx
import { useEffect } from "react"
import { useValue } from "valdres-react"
import { publicIpAtom, requestPublicIp } from "@valdres/public-ip"

function PublicIp() {
    const { status, ip, error } = useValue(publicIpAtom)

    // Ask once when this component mounts, and stop waiting when it unmounts.
    useEffect(() => {
        const controller = new AbortController()
        requestPublicIp({ signal: controller.signal }).catch(() => {})
        return () => controller.abort()
    }, [])

    if (status === "error") return <span>Lookup failed: {error!.message}</span>
    return <span>{ip ?? "Looking up…"}</span>
}
```

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet. Until they ship,
> read this package with `store.get` / `store.sub` as above.

## Exports

| Export                                                               | Kind                      | Type                                                                                                    |
| -------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `publicIpAtom`                                                       | external atom (read-only) | `PublicIpState` — either family                                                                         |
| `publicIpV4Atom`                                                     | external atom (read-only) | `PublicIpState` — IPv4 only                                                                             |
| `publicIpV6Atom`                                                     | external atom (read-only) | `PublicIpState` — IPv6 only                                                                             |
| `publicIpValueAtom`, `publicIpV4ValueAtom`, `publicIpV6ValueAtom`    | selector (read-only)      | `string \| null`                                                                                        |
| `publicIpStatusAtom`, `publicIpV4StatusAtom`, `publicIpV6StatusAtom` | selector (read-only)      | `PublicIpStatus`                                                                                        |
| `publicIpErrorAtom`, `publicIpV4ErrorAtom`, `publicIpV6ErrorAtom`    | selector (read-only)      | `PublicIpError \| null`                                                                                 |
| `requestPublicIp`                                                    | util fn                   | `(options?: PublicIpRequestOptions) => Promise<string>`                                                 |
| `fetchPublicIp`                                                      | util fn                   | `(options?: PublicIpRequestOptions) => Promise<string>` — stateless                                     |
| `PublicIpState`                                                      | type                      | `{ status, ip: string \| null, updatedAt: number \| null, error: PublicIpError \| null }`               |
| `PublicIpStatus`                                                     | type                      | `"unsupported" \| "idle" \| "pending" \| "ready" \| "error"`                                            |
| `PublicIpError`                                                      | type                      | `{ name: string; message: string }`                                                                     |
| `PublicIpFamily`                                                     | type                      | `"any" \| "v4" \| "v6"`                                                                                 |
| `PublicIpRequestOptions`                                             | type                      | `{ family?, endpoints?: readonly string[], timeoutMs?: number, signal?: AbortSignal, fresh?: boolean }` |

## State

| `status`        | Meaning                                        | `ip` / `updatedAt`                           | `error` |
| --------------- | ---------------------------------------------- | -------------------------------------------- | ------- |
| `"unsupported"` | The runtime has no `fetch`.                    | `null`                                       | `null`  |
| `"idle"`        | Nothing requested yet in this page or process. | `null`                                       | `null`  |
| `"pending"`     | A request is in flight.                        | the previous address, if any                 | `null`  |
| `"ready"`       | The latest request succeeded.                  | its address and `Date.now()` when it arrived | `null`  |
| `"error"`       | The latest request failed.                     | the previous address, if any                 | why     |

Each snapshot is frozen and published as one value, so status, address and
error never disagree. An address survives a pending or failed refresh; check
`status === "ready"` (or `updatedAt`) when only a current answer will do.

## Requesting

`requestPublicIp(options?)` asks each endpoint in order, with a per-endpoint
timeout (default 4 s), and resolves the first trimmed response body that is an
address of the requested family. A rejected request, a non-2xx status, a
timeout, or a body that is not a valid address moves on to the next endpoint;
when every endpoint fails the promise rejects with an `AggregateError` of their
failures and the state turns `"error"`.

| `family`          | Default endpoints                                      | State            |
| ----------------- | ------------------------------------------------------ | ---------------- |
| `"any"` (default) | `https://api.ipify.org`, `https://icanhazip.com`       | `publicIpAtom`   |
| `"v4"`            | `https://api4.ipify.org`, `https://ipv4.icanhazip.com` | `publicIpV4Atom` |
| `"v6"`            | `https://api6.ipify.org`, `https://ipv6.icanhazip.com` | `publicIpV6Atom` |

Pass `endpoints` to use your own service: each must answer a plain `GET` with
the address as the response body.

- **Sharing.** Concurrent calls for the same family share one request; the
  options of a call that joins are ignored. `fresh: true` aborts the in-flight
  request instead (its callers reject with an `AbortError`) and starts a new
  one.
- **Cancellation.** `signal` cancels only that caller: its promise rejects with
  the signal's reason. When every caller sharing the request has cancelled, the
  request is aborted and the state returns to what it was before. A caller
  without a signal keeps the request running.
- **Ordering.** Only the newest request publishes. A replaced or cancelled
  request whose response still arrives — an abort cannot always stop a response
  that is already completing — changes nothing.
- **No automatic work.** Nothing retries a failure, refreshes on a timer, or
  reacts to `online`, visibility or connection changes. Call again when you
  want a new answer.
- **Errors.** Invalid options throw `TypeError` before anything is sent.
  Without `fetch` the promise rejects with `NotSupportedError`. A Store
  subscriber that throws while the state is published is reported through
  `globalThis.reportError` (or thrown in a later task) and never changes the
  promise's outcome; every other Store is still notified.

### Privacy

A request necessarily reveals the caller's public IP address to every endpoint
it reaches — that is how the endpoint answers. With the defaults that is
ipify, and icanhazip when ipify fails. Requests send no cookies or referrer and
bypass the HTTP cache. Point `endpoints` at a service you operate if a third
party must not see your users' addresses, and ask for consent where your users
expect it.

## Ownership and lifetime

The address is a fact about the network the page (or worker, or server process)
is on, so the state belongs to that JavaScript realm and is shared by every
Store: root Stores, their scopes and independent Stores all read the same
snapshot, and a Store created later reads the latest result without
requesting. Subscribing only registers a store tree for notifications — once
per tree, shared by its scopes, released by its last unsubscribe or by
`dispose()`. Unsubscribing or disposing a Store never cancels a request; use a
`signal` for that. A disposed Store receives nothing afterwards.

Calling `requestPublicIp()` inside a transaction or a `settle` handler starts
the request immediately and notifies that Store once the transaction is over;
prefer event handlers and effects.

## Server rendering

The server snapshot is the fixed seed
`{ status: "idle", ip: null, updatedAt: null, error: null }`; nothing is
requested during a server render, and `useValue` renders the seed first and the
live state after hydration. On a server, the state would be shared by every
request the process handles, so look the address up with the stateless
`fetchPublicIp(options?)` instead: same options and validation, no
publication, no sharing.

## Migrating from 1.0.0-beta.8

| Before                                                                                                        | Now                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading `publicIpAtom` (or V4/V6) fetched the address and suspended (`Promise<string> \| string`)             | Reading never fetches. `publicIpAtom` is a read-only `ExternalAtom<PublicIpState>`; call `requestPublicIp()` to look the address up.                                      |
| Re-fetched on window `online`, on `visibilitychange` to visible and on `navigator.connection` `change`        | Nothing refreshes automatically. Call `requestPublicIp()` from those events yourself if you want that (example below).                                                    |
| `publicIpMaxAgeAtom`, `publicIpStaleWhileRevalidateAtom`, `publicIpStaleIfErrorAtom`                          | Removed. There is no automatic revalidation; the previous address is always kept while pending and after a failure, and `updatedAt` says how old it is.                   |
| `publicIpEndpointsAtom`, `publicIpV4EndpointsAtom`, `publicIpV6EndpointsAtom` (settable)                      | `requestPublicIp({ family, endpoints })`.                                                                                                                                 |
| `publicIpStatusAtom` etc. were settable atoms with `"idle" \| "loading" \| "revalidating" \| "ok" \| "error"` | Read-only selectors over the coherent state, with `"idle" \| "pending" \| "ready" \| "error"` (plus `"unsupported"`); "revalidating" is `"pending"` with a non-null `ip`. |
| `publicIpErrorAtom` held an `Error`                                                                           | A frozen `{ name, message }`; the promise still rejects with the real error.                                                                                              |
| `fetchPublicIp(endpoints, validate?, timeoutMs?)`                                                             | `fetchPublicIp({ family?, endpoints?, timeoutMs?, signal? })`.                                                                                                            |
| Peer `valdres` `^1.0.0-beta.19`                                                                               | `^1.0.0-beta.39`, the first core with `externalAtom`.                                                                                                                     |

To keep the old refresh-on-reconnect behavior, wire it explicitly:

```ts
import { requestPublicIp } from "@valdres/public-ip"

const refresh = () => {
    if (navigator.onLine) requestPublicIp().catch(() => {})
}
window.addEventListener("online", refresh)
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh()
})
```

---

Full documentation: https://valdres.dev/react/plugins/public-ip

<!-- DOCS:END -->
