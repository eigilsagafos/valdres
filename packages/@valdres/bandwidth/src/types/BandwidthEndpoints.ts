/**
 * A measurement server speaking Cloudflare's speed-test protocol:
 *
 * - `download`: `GET <download>?bytes=N` (or `&bytes=N` when the URL already
 *   has a query) answers 2xx with a body of N bytes. `bytes=0` is used for the
 *   latency samples.
 * - `upload`: `POST <upload>` with a raw binary body of up to 1 MB answers
 *   2xx; the response body is read and discarded.
 *
 * Cross-origin servers must allow the page's origin with CORS. No other
 * speed-test protocol is supported.
 */
export interface BandwidthEndpoints {
    readonly download: string
    readonly upload: string
}
