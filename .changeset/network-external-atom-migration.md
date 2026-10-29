---
---

Migrate `@valdres/public-ip` and `@valdres/bandwidth` from the removed
`globalAtom` / `globalStore` and async atom initializers to the public
`externalAtom` primitive, with explicit network operations.

Intentionally empty: both packages are still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement
is a separate change, and its changeset must carry the breaking changes:

- Network work starts only from an explicit call. Reading, subscribing,
  importing and server rendering no longer request anything.
  `@valdres/public-ip` no longer fetches on first read, revalidates on a timer
  (`maxAge` / `staleWhileRevalidate` / `staleIfError`) or re-fetches on
  `online`, `visibilitychange` or `navigator.connection` `change`; call
  `requestPublicIp({ family?, endpoints?, timeoutMs?, signal?, fresh? })`.
  `@valdres/bandwidth` no longer measures when a speed atom is read or
  subscribed; call `measureBandwidth(options)`.
- `publicIpAtom` / `publicIpV4Atom` / `publicIpV6Atom` are read-only
  `ExternalAtom<PublicIpState>` (`{ status, ip, updatedAt, error }`) instead of
  async `Promise<string> | string` atoms; the value/status/error exports are
  read-only selectors. Statuses are `"unsupported" | "idle" | "pending" |
  "ready" | "error"` (was `"idle" | "loading" | "revalidating" | "ok" |
  "error"`); errors are frozen `{ name, message }` copies.
- Removed: `publicIpEndpointsAtom`, `publicIpV4EndpointsAtom`,
  `publicIpV6EndpointsAtom`, `publicIpMaxAgeAtom`,
  `publicIpStaleWhileRevalidateAtom`, `publicIpStaleIfErrorAtom`,
  `invalidateOnAtom` and `invalidateMeasurement` (use
  `measureBandwidth({ fresh: true })`).
- `fetchPublicIp(endpoints, validate?, timeoutMs?)` is now
  `fetchPublicIp({ family?, endpoints?, timeoutMs?, signal? })`.
- `bandwidthAtom` (`{ status, phase, progress, result, error }`) is new;
  `downloadSpeedAtom`, `uploadSpeedAtom`, `latencyAtom`, `jitterAtom` and
  `lastMeasurementAtom` are read-only `number | null` selectors of the last
  completed result (no live updates; those are `progress`).
  `measurementStatusAtom` is a read-only selector with
  `"unsupported" | "idle" | "pending" | "ready" | "error"` (was
  `"measuring-latency" | "measuring-download" | "measuring-upload" |
  "complete"` …); the phase is `bandwidthAtom`'s `phase`.
- State is shared by every Store in the realm; `fresh` replaces a running
  operation, a per-caller `signal` cancels only that
  caller, and only the newest operation publishes. A cancelled or replaced
  measurement rejects and never reports partial numbers.
- Requests send no cookies or referrer and bypass the HTTP cache.
- The `valdres` peer range is `^1.0.0-beta.39`, the first core with
  `externalAtom`.
- Concurrent calls share an operation only when their effective
  configuration matches; a conflicting call rejects with
  `PublicIpRequestConflictError` / `BandwidthMeasurementConflictError`
  instead of silently receiving another configuration's result.
- `@valdres/bandwidth` has per-direction application-payload budgets,
  `maxDownloadBytes` (default 25 MB) and `maxUploadBytes` (default 10 MB) —
  not on-wire caps. Results carry `downloadBytes` / `uploadBytes`,
  `downloadEndedBy` / `uploadEndedBy` and `downloadDurationMs` /
  `uploadDurationMs`; a phase that ends on its budget before any progress tick
  still completes from its bytes and measured duration. A phase with no
  payload, or one timed over less than 20 ms, rejects with
  `BandwidthInsufficientDataError` (`reason`). `endpoints: { download, upload }`
  targets a server speaking Cloudflare's speed-test protocol.
- Neither operation is transactional: one started in a transaction that
  throws keeps running and is published after the transaction.
