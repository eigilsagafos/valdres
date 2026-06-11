<!-- DOCS:START -->

# public-ip

Fetches your public IP from a list of HTTP endpoints and exposes it as global atoms, with stale-while-revalidate caching. `publicIpAtom` resolves to the IP (`Promise<string>` on first read, then `string`).

> **Async atom**
>
>
> `publicIpAtom` suspends on first read. Wrap consumers in `<Suspense>`, or read the non-suspending `publicIpValueAtom` / `publicIpStatusAtom` instead.

## Install

```bash
bun add @valdres/public-ip
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/public-ip](https://valdres.dev/react/plugins/public-ip)

## Usage

```tsx
import { Suspense } from "react"
import { useValue } from "valdres-react"
import { publicIpAtom } from "@valdres/public-ip"

function Ip() {
    const ip = useValue(publicIpAtom) // string (suspends until resolved)
    return <span>{ip}</span>
}

function App() {
    return (
        <Suspense fallback="Loading…">
            <Ip />
        </Suspense>
    )
}
```

## Exports

| Export                             | Kind             | Type                                                                                              |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `publicIpAtom`                     | atom (read-only) | `Promise<string> \| string`                                                                       |
| `publicIpStatusAtom`               | atom (read-only) | `PublicIpStatus`                                                                                  |
| `publicIpErrorAtom`                | atom (read-only) | `Error \| null`                                                                                   |
| `publicIpValueAtom`                | atom (read-only) | `string \| null`                                                                                  |
| `publicIpV4Atom`                   | atom (read-only) | `Promise<string> \| string`                                                                       |
| `publicIpV4StatusAtom`             | atom (read-only) | `PublicIpStatus`                                                                                  |
| `publicIpV4ErrorAtom`              | atom (read-only) | `Error \| null`                                                                                   |
| `publicIpV4ValueAtom`              | atom (read-only) | `string \| null`                                                                                  |
| `publicIpV6Atom`                   | atom (read-only) | `Promise<string> \| string`                                                                       |
| `publicIpV6StatusAtom`             | atom (read-only) | `PublicIpStatus`                                                                                  |
| `publicIpV6ErrorAtom`              | atom (read-only) | `Error \| null`                                                                                   |
| `publicIpV6ValueAtom`              | atom (read-only) | `string \| null`                                                                                  |
| `publicIpEndpointsAtom`            | atom (settable)  | `string[]`                                                                                        |
| `publicIpV4EndpointsAtom`          | atom (settable)  | `string[]`                                                                                        |
| `publicIpV6EndpointsAtom`          | atom (settable)  | `string[]`                                                                                        |
| `publicIpMaxAgeAtom`               | atom (settable)  | `number` (ms)                                                                                     |
| `publicIpStaleWhileRevalidateAtom` | atom (settable)  | `number` (ms)                                                                                     |
| `publicIpStaleIfErrorAtom`         | atom (settable)  | `number` (ms)                                                                                     |
| `fetchPublicIp`                    | util fn          | `(endpoints: string[], validate?: (v: string) => boolean, timeoutMs?: number) => Promise<string>` |
| `PublicIpStatus`                   | type             | `"idle" \| "loading" \| "revalidating" \| "ok" \| "error"`                                        |

The `V4` / `V6` atoms are the same shape, fetching from IPv4- and IPv6-only endpoints. Endpoint, `maxAge`, `staleWhileRevalidate`, and `staleIfError` atoms are settable to tune fetching.

## Cross-framework

Atoms are global: the fetch starts on the first subscriber and the result is shared across every store. Only the read primitive changes per framework (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` / `store.sub` in plain JS).

---

Full documentation: https://valdres.dev/react/plugins/public-ip

<!-- DOCS:END -->
