<!-- DOCS:START -->

# bandwidth

Runs an active network measurement when you ask — latency and jitter, then
download and upload throughput against Cloudflare's speed-test endpoints, or a
compatible server you configure — and
publishes its progress and result as read-only state.

> **Transfers data only when you call it**
>
>
> Importing, reading, subscribing and server rendering never transfer
> anything. Only `measureBandwidth()` does, and a measurement
> deliberately loads the connection: by default up to 25 MB down and
> 10 MB up, within 5–10 s per direction.

## Install

```bash
bun add @valdres/bandwidth
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/bandwidth](https://valdres.dev/react/plugins/bandwidth)

## Usage

```ts
import { store } from "valdres"
import { bandwidthAtom, measureBandwidth } from "@valdres/bandwidth"

const app = store()
app.sub(bandwidthAtom, () => {
    const { status, phase, progress, result } = app.get(bandwidthAtom)
    if (status === "pending") render(`Measuring ${phase}…`, progress)
    else if (result)
        render(`${result.downloadMbps.toFixed(1)} Mbps down`, result)
})

const controller = new AbortController()
button.addEventListener("click", () => {
    measureBandwidth({ signal: controller.signal }).catch(() => {}) // the state records failures
})
cancelButton.addEventListener("click", () => controller.abort())
```

```tsx
import { useEffect, useRef } from "react"
import { useValue } from "valdres-react"
import { bandwidthAtom, measureBandwidth } from "@valdres/bandwidth"

function SpeedTest() {
    const { status, phase, progress, result, error } = useValue(bandwidthAtom)
    const running = useRef<AbortController | null>(null)

    // Stop transferring if this component goes away mid-measurement.
    useEffect(() => () => running.current?.abort(), [])

    const start = () => {
        running.current = new AbortController()
        measureBandwidth({ signal: running.current.signal }).catch(() => {})
    }

    if (status === "pending")
        return (
            <span>
                Measuring {phase}… {progress?.downloadMbps?.toFixed(1) ?? "–"}{" "}
                Mbps
            </span>
        )
    return (
        <>
            {result && (
                <span>
                    {result.downloadMbps.toFixed(1)} Mbps ·{" "}
                    {result.latencyMs.toFixed(0)} ms
                </span>
            )}
            {error && <span>Failed: {error.message}</span>}
            <button onClick={start}>
                {result ? "Measure again" : "Measure"}
            </button>
        </>
    )
}
```

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet. Until they ship,
> read this package with `store.get` / `store.sub` as above.

## Exports

| Export                              | Kind                      | Type                                                                                                                       |
| ----------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `bandwidthAtom`                     | external atom (read-only) | `BandwidthState`                                                                                                           |
| `downloadSpeedAtom`                 | selector (read-only)      | `number \| null` — Mbps, last result                                                                                       |
| `uploadSpeedAtom`                   | selector (read-only)      | `number \| null` — Mbps, last result                                                                                       |
| `latencyAtom`                       | selector (read-only)      | `number \| null` — ms, last result                                                                                         |
| `jitterAtom`                        | selector (read-only)      | `number \| null` — ms, last result                                                                                         |
| `lastMeasurementAtom`               | selector (read-only)      | `number \| null` — `Date.now()` of the last result                                                                         |
| `measurementStatusAtom`             | selector (read-only)      | `MeasurementStatus`                                                                                                        |
| `measureBandwidth`                  | util fn                   | `(options?: MeasureBandwidthOptions) => Promise<BandwidthResult>`                                                          |
| `BandwidthMeasurementConflictError` | error class               | rejects a call whose configuration conflicts with the running measurement                                                  |
| `BandwidthInsufficientDataError`    | error class               | rejects a measurement whose download or upload phase produced no usable reading                                            |
| `BandwidthState`                    | type                      | `{ status, phase, progress, result, error }`                                                                               |
| `BandwidthResult`                   | type                      | `{ downloadMbps, uploadMbps, latencyMs, jitterMs, downloadBytes, uploadBytes, downloadEndedBy, uploadEndedBy, timestamp }` |
| `BandwidthProgress`                 | type                      | `{ latencyMs, jitterMs, downloadMbps, uploadMbps, downloadBytes, uploadBytes: number \| null }`                            |
| `BandwidthEndpoints`                | type                      | `{ download: string; upload: string }`                                                                                     |
| `BandwidthMeasurementConfig`        | type                      | every option except `signal` / `fresh`, with defaults applied                                                              |
| `BandwidthError`                    | type                      | `{ name: string; message: string }`                                                                                        |
| `MeasurementStatus`                 | type                      | `"unsupported" \| "idle" \| "pending" \| "ready" \| "error"`                                                               |
| `MeasurementPhase`                  | type                      | `"latency" \| "download" \| "upload"`                                                                                      |
| `MeasurementPhaseEnd`               | type                      | `"stable" \| "time" \| "bytes" \| "drained"`                                                                               |
| `MeasureBandwidthOptions`           | type                      | see [Options](#options)                                                                                                    |

## State

| `status`        | Meaning                                                                         | `phase` / `progress`                                                         | `result`                    | `error` |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------- | ------- |
| `"unsupported"` | No `fetch` or `performance.now`.                                                | `null`                                                                       | `null`                      | `null`  |
| `"idle"`        | Nothing measured yet in this page or process.                                   | `null`                                                                       | `null`                      | `null`  |
| `"pending"`     | An active measurement is running and transferring data.                         | the running phase, its provisional readings and the bytes transferred so far | the previous result, if any | `null`  |
| `"ready"`       | The latest measurement completed.                                               | `null`                                                                       | its result                  | `null`  |
| `"error"`       | The latest measurement failed or had too little data (`error.name` says which). | `null`                                                                       | the previous result, if any | why     |

Each snapshot is frozen and published as one value. The selectors read `result`
only — a completed measurement — so they never show a provisional reading; read
`bandwidthAtom`'s `progress` for live numbers.

A call ends in exactly one of four ways:

| Outcome               | Promise                                                                                                                        | State                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Completed             | resolves the `BandwidthResult`                                                                                                 | `"ready"` with it as `result`                                        |
| Too little data       | rejects with `BandwidthInsufficientDataError` (`phase`, `reason`: `"no-data"` or `"interval-too-short"`, `bytes`, `elapsedMs`) | `"error"`, previous `result` kept                                    |
| Failed request        | rejects with that request's error                                                                                              | `"error"`, previous `result` kept                                    |
| Cancelled or replaced | rejects with the signal's reason / `AbortError`                                                                                | back to what it was before (cancel) or the replacement's `"pending"` |

## What is measured

Everything here is an **active measurement** between this client and the
measurement server, never a browser estimate. The package does not read
`navigator.connection` (`downlink`, `rtt`, `effectiveType`): those are coarse,
rounded estimates that only some browsers expose, and they are never
substituted for a measurement.

| Phase    | Requests                                                                                                                                                                         | Result                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| latency  | one warm-up, then `latencySamples` (10) sequential `GET <download>?bytes=0`                                                                                                      | `latencyMs`: median round trip, ms. `jitterMs`: population standard deviation of those round trips, ms. |
| download | `startStreams` (2) to `maxStreams` (8) parallel streams of `GET <download>?bytes=N`, N ≤ 10 MB per request and never more than the download budget has left, read as they arrive | `downloadMbps`, `downloadBytes`, `downloadEndedBy`, `downloadDurationMs`                                |
| upload   | the same number of parallel streams of `POST <upload>` with up to 1 MB each, never more than the upload budget has left                                                          | `uploadMbps`, `uploadBytes`, `uploadEndedBy`, `uploadDurationMs`                                        |

Throughput is in megabits per second (1 Mbps = 1,000,000 bits/s). Every 250 ms
a phase computes the rate over the last 1.5 s and smooths it (exponential moving
average, α = 0.2); `progress` shows that smoothed rate and the bytes so far.
These periodic ticks only drive progress and the stability check — the final
result never depends on one having fired. A phase ends at the first of:

| `…EndedBy`  | When                                                                                                                                                                     | `…Mbps`                                                  | `…DurationMs`                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------ |
| `"stable"`  | after `minDurationMs` (5 s), the coefficient of variation of the last four unsmoothed readings (ignoring the first `warmupMs`, 2 s) is below `stabilityThreshold` (0.05) | the smoothed rate                                        | phase start to its end               |
| `"time"`    | `maxDurationMs` (10 s), on its own timer                                                                                                                                 | the smoothed rate; bytes ÷ duration if no tick fired yet | phase start to its end               |
| `"bytes"`   | the phase's payload budget has been transferred                                                                                                                          | bytes ÷ duration                                         | phase start to the last counted byte |
| `"drained"` | every stream finished on its own (a runtime without streamed bodies)                                                                                                     | bytes ÷ duration                                         | phase start to the last counted byte |

A byte-limited phase can end well before the first 250 ms tick on a fast link;
its result is then still computed from its byte count and measured duration,
and `…EndedBy: "bytes"` with a short `…DurationMs` says so. Such a short sample
includes request start-up and first-byte latency and may also reflect data the
network or browser had already buffered, so it **may not represent sustained
throughput** — in either direction. Raise the budget when you need a longer
sample.

No rate is invented when there is nothing defensible to compute: a phase that
carried no payload bytes rejects with `BandwidthInsufficientDataError`
(`reason: "no-data"`), and one whose bytes arrived over less than **20 ms**
rejects with `reason: "interval-too-short"` — browsers coarsen
`performance.now()` to as much as 1 ms, which would make a shorter interval's
rate unreliable by more than 5 %. Past `minDurationMs`, a reading more than
15 % above the previous one opens another stream, up to `maxStreams`.

Limitations: the result is throughput to the measurement server over this
browser's network path at that moment — other traffic, Wi-Fi conditions, VPNs
and the browser's own connection limits all lower it, and it is not the
capacity of the line. Latency includes HTTP request overhead, so it is higher
than an ICMP ping.

### Data transferred and payload budgets

`maxDownloadBytes` and `maxUploadBytes` are **application-payload budgets per
direction**, defaulting to **25 MB down and 10 MB up**:

- The download budget bounds the response-body bytes the measurement **asks
  for**: each request is sized to what the budget has left, and the phase stops
  once the bytes it has read reach the budget.
- The upload budget bounds the request-body bytes the measurement **hands to
  `fetch`**. A request's bytes count against it as soon as the request starts,
  even if it is then cut off by the end of the phase, a failure or a
  cancellation; only acknowledged bytes count toward `uploadBytes` and the rate.

They are not an on-wire cap. HTTP headers, TLS and TCP overhead are not
counted, and the payload actually transferred can exceed a budget: a server
may send more than was asked for, and the browser may already have received
and buffered data by the time the stream is cancelled. The measurement stops
reading as soon as its count reaches the budget, but how much more arrived
over the network is not bounded by this package. `downloadBytes` and
`uploadBytes` report what was actually counted, which can be slightly above
the budget.

Besides the throughput phases, each measurement makes `latencySamples` + 1
(default 11) latency requests that ask for zero payload bytes; they are not
counted against either budget, and their traffic is headers and connection
setup only. Nothing is retried: a failed request fails the measurement.

|         | Download | Upload | Payload budget per measurement                                  |
| ------- | -------- | ------ | --------------------------------------------------------------- |
| Default | 25 MB    | 10 MB  | 35 MB, plus headers, TLS, latency probes and any server overrun |

The trade-off: with the defaults, a phase ends on its budget before
`minDurationMs` (5 s) on links faster than about **40 Mbps down and 16 Mbps
up** (budget × 8 ÷ 5 s), and before the 2 s warm-up above about 100 / 40 Mbps.
Such results are marked `"bytes"` and come from a shorter sample than a
time-bounded phase, with the caveats above. Raise the budgets deliberately for
longer samples on fast links, knowing each measurement may then transfer that
much; `Infinity` lifts a budget and leaves only the time limits.

Repeated measurements multiply the cost. Do not run measurements
automatically, on a timer, or on metered or mobile connections without the
user's consent.

### Endpoints

By default every request goes to Cloudflare's speed test,
`https://speed.cloudflare.com/__down` and `__up`; no other service is
contacted, and Cloudflare sees the client's IP address as with any request.
Requests send no cookies or referrer and bypass the HTTP cache.

`endpoints: { download, upload }` points a measurement at another server that
speaks **the same protocol** — this is not compatible with arbitrary speed-test
servers:

- `GET <download>?bytes=N` (or `&bytes=N` when the URL already has a query)
  answers 2xx with a body of N bytes. `bytes=0` is the latency probe.
- `POST <upload>` with a raw binary body of up to 1 MB answers 2xx; the response
  body is read and discarded.
- Cross-origin servers must send CORS headers allowing the page's origin.

## Options

| Option                                | Default        |                                                                |
| ------------------------------------- | -------------- | -------------------------------------------------------------- |
| `endpoints`                           | Cloudflare     | see [Endpoints](#endpoints)                                    |
| `maxDownloadBytes` / `maxUploadBytes` | 25 MB / 10 MB  | per-direction payload budgets; positive integers or `Infinity` |
| `maxDurationMs` / `minDurationMs`     | 10 000 / 5 000 | per throughput phase                                           |
| `warmupMs`                            | 2 000          | readings ignored for stability                                 |
| `startStreams` / `maxStreams`         | 2 / 8          | parallel streams per phase                                     |
| `stabilityThreshold`                  | 0.05           | coefficient of variation                                       |
| `latencySamples`                      | 10             | after one warm-up request                                      |
| `signal`                              | —              | cancels this caller                                            |
| `fresh`                               | `false`        | replace a running measurement                                  |

## Measuring

- **One at a time, shared only when compatible.** There is one measurement at a
  time per page or process — two would compete for the same link. Its
  **effective configuration** is every option except `signal` and `fresh`, with
  defaults applied:

  | A call while a measurement is running…  | Result                                                                                                                        |
  | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
  | with the same effective configuration   | joins it; every caller gets its outcome                                                                                       |
  | with any other server, limit or setting | rejects with `BandwidthMeasurementConflictError` (`active`, `requested`); the running measurement and the state are untouched |
  | with `fresh: true` (any configuration)  | aborts the running measurement — **its other callers reject with `AbortError`** — and starts this one                         |

- **Cancellation.** `signal` cancels only that caller: its promise rejects with
  the signal's reason. When every caller sharing the measurement has cancelled,
  all its requests are aborted, no further transfer is scheduled, and the state
  returns to what it was before. A caller without a signal keeps it running. A
  cut-short phase never produces a result.

- **Ordering.** Only the newest measurement publishes. A replaced or cancelled
  one whose readings still arrive changes nothing.

- **Transactions.** A measurement is not transactional. Calling
  `measureBandwidth()` inside a transaction or `settle` handler starts it
  immediately; if the transaction then throws, the measurement is **not**
  rolled back — it keeps transferring and its outcome is published as usual
  (the Store is notified once the transaction is over, never during it). Pass a
  `signal` and abort it if it should not outlive a failed transaction.

- **No automatic work.** Nothing retries a failure or measures again. Call
  `measureBandwidth()` when you want a new result.

- **Errors.** Invalid options throw `TypeError` before anything is sent.
  Without `fetch` or `performance.now` the promise rejects with
  `NotSupportedError`. The first failing request (for example
  `download failed: 503`) fails the measurement. A Store subscriber that
  throws while the state is published is reported through
  `globalThis.reportError` (or thrown in a later task) and never changes the
  promise's outcome; every other Store is still notified.

## Ownership and lifetime

The measurement and its result belong to the JavaScript realm (the page, worker
or process) and are shared by every Store: root Stores, their scopes and
independent Stores read the same snapshot, and a Store created later reads the
latest result without measuring. Subscribing only registers a store tree for
notifications — once per tree, shared by its scopes, released by its last
unsubscribe or `dispose()`. Unsubscribing or disposing a Store never stops a
measurement; abort its `signal` for that. A disposed Store receives nothing
afterwards.

Prefer calling `measureBandwidth()` from event handlers and effects; inside a
transaction it starts immediately and is not rolled back (see Measuring).

## Server rendering

The server snapshot is the fixed idle seed; nothing is measured during a server
render, and `useValue` renders the seed first and the live state after
hydration.

## Migrating from 1.0.0-beta.8

| Before                                                                                                                                     | Now                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading or subscribing to `downloadSpeedAtom`, `uploadSpeedAtom`, `latencyAtom` or `jitterAtom` started a full measurement and suspended   | Reading never measures. Call `measureBandwidth()`; the selectors are `number \| null` (`null` until a measurement completes).                                                                                                                                                                       |
| Those atoms updated live during a measurement                                                                                              | They hold completed results only. Live readings are `bandwidthAtom`'s `progress`, labelled by `phase`.                                                                                                                                                                                              |
| `measurementStatusAtom` (settable): `"idle" \| "measuring-latency" \| "measuring-download" \| "measuring-upload" \| "complete" \| "error"` | Read-only: `"idle" \| "pending" \| "ready" \| "error"` (plus `"unsupported"`); the phase is `bandwidthAtom`'s `phase`.                                                                                                                                                                              |
| `lastMeasurementAtom` (settable)                                                                                                           | Read-only selector of the last result's `timestamp`.                                                                                                                                                                                                                                                |
| `invalidateOnAtom` re-measured whenever listed global atoms changed                                                                        | Removed. Subscribe to what should trigger a new measurement and call `measureBandwidth({ fresh: true })` (example below).                                                                                                                                                                           |
| `invalidateMeasurement()`                                                                                                                  | `measureBandwidth({ fresh: true })`.                                                                                                                                                                                                                                                                |
| An abort mid-phase could still complete with partial numbers                                                                               | A cancelled or replaced measurement rejects and never publishes a result.                                                                                                                                                                                                                           |
| Each phase streamed 100 MB requests for 5–10 s — gigabytes per measurement on a fast link                                                  | Per-direction payload budgets, default 25 MB down / 10 MB up (see [Data transferred and payload budgets](#data-transferred-and-payload-budgets)); a phase ended by its budget reports bytes ÷ duration with `…EndedBy: "bytes"` and its `…DurationMs`. Pass `Infinity` to restore time-only phases. |
| Only Cloudflare                                                                                                                            | Cloudflare by default; `endpoints` for a server speaking the same protocol.                                                                                                                                                                                                                         |
| A joining call's options were ignored                                                                                                      | Calls share a measurement only with the same configuration; a conflicting call rejects with `BandwidthMeasurementConflictError`.                                                                                                                                                                    |
| Peer `valdres` `^1.0.0-beta.19`                                                                                                            | `^1.0.0-beta.39`, the first core with `externalAtom`.                                                                                                                                                                                                                                               |

To re-measure when something changes, wire it explicitly — and consider the data
cost before doing so:

```ts
import { store } from "valdres"
import { measureBandwidth } from "@valdres/bandwidth"
import { publicIpValueAtom } from "@valdres/public-ip"

const app = store()
let previous = app.get(publicIpValueAtom)
app.sub(publicIpValueAtom, () => {
    const ip = app.get(publicIpValueAtom)
    if (ip !== null && previous !== null && ip !== previous)
        measureBandwidth({ fresh: true }).catch(() => {})
    previous = ip
})
```

---

Full documentation: https://valdres.dev/react/plugins/bandwidth

<!-- DOCS:END -->
