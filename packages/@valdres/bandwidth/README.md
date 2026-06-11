<!-- DOCS:START -->

# bandwidth

Download/upload speed, latency, and jitter from a live measurement, as async global atoms.

> **Runs a measurement**
>
>
> Reading a measured atom triggers a download/upload test on first subscribe. Call `invalidateMeasurement()` to discard the result and re-run.

## Install

```bash
bun add @valdres/bandwidth
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/bandwidth](https://valdres.dev/react/plugins/bandwidth)

## Usage

```tsx
import { Suspense } from "react"
import { useValue } from "valdres-react"
import { downloadSpeedAtom, latencyAtom } from "@valdres/bandwidth"

function Speed() {
    const download = useValue(downloadSpeedAtom)
    const latency = useValue(latencyAtom)
    return <span>{download.toFixed(1)} Mbps · {latency.toFixed(0)} ms</span>
}

// The measured atoms suspend until the test resolves
export function App() {
    return (
        <Suspense fallback="Measuring…">
            <Speed />
        </Suspense>
    )
}
```

## Exports

| Export                    | Kind                    | Type                                                                                                                                                             |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `downloadSpeedAtom`       | atom (read-only, async) | `number` — Mbps                                                                                                                                                  |
| `uploadSpeedAtom`         | atom (read-only, async) | `number` — Mbps                                                                                                                                                  |
| `latencyAtom`             | atom (read-only, async) | `number` — ms                                                                                                                                                    |
| `jitterAtom`              | atom (read-only, async) | `number` — ms                                                                                                                                                    |
| `measurementStatusAtom`   | atom (settable)         | `MeasurementStatus`                                                                                                                                              |
| `lastMeasurementAtom`     | atom (settable)         | `number \| null` — timestamp                                                                                                                                     |
| `invalidateOnAtom`        | atom (settable)         | `GlobalAtom<unknown>[]`                                                                                                                                          |
| `measureBandwidth`        | util fn                 | `(options?: MeasureBandwidthOptions) => Promise<BandwidthResult>`                                                                                                |
| `invalidateMeasurement`   | util fn                 | `() => void`                                                                                                                                                     |
| `MeasurementStatus`       | type                    | `"idle" \| "measuring-latency" \| "measuring-download" \| "measuring-upload" \| "complete" \| "error"`                                                           |
| `BandwidthResult`         | type                    | `{ downloadMbps, uploadMbps, latencyMs, jitterMs, timestamp: number }`                                                                                           |
| `MeasureBandwidthOptions` | type                    | `{ latencySamples?, maxDurationMs?, minDurationMs?, warmupMs?, startStreams?, maxStreams?, stabilityThreshold?: number; signal?: AbortSignal; fresh?: boolean }` |

## Cross-framework

One in-flight measurement is shared across every store and framework. `invalidateMeasurement()` clears the result and, if anything is subscribed, kicks off a fresh run.

---

Full documentation: https://valdres.dev/react/plugins/bandwidth

<!-- DOCS:END -->
