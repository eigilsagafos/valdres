/**
 * Serves the manual iOS Safari check page (see IOS-SAFARI-CHECK.md).
 *
 *   bun run scripts/browser-permission-probe/ios-safari.ts
 *   # HTTPS directly, with a certificate the device trusts (e.g. mkcert):
 *   TLS_CERT=cert.pem TLS_KEY=key.pem bun run scripts/browser-permission-probe/ios-safari.ts
 *
 * iOS only exposes motion and orientation to secure contexts, so open the page
 * over HTTPS: either through an HTTPS tunnel to the printed port, or with the
 * TLS variables above. Plain http:// over the LAN is the "insecure" case.
 */
import { join } from "node:path"

const bundle = await Bun.build({
    entrypoints: [join(import.meta.dir, "ios-safari-page.ts")],
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
})
if (!bundle.success) {
    for (const log of bundle.logs) console.error(log)
    process.exit(1)
}
const source = await bundle.outputs[0]!.text()

const HTML = `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Valdres motion/orientation — iOS Safari check</title>
<style>
  body { font: 16px/1.4 -apple-system, system-ui, sans-serif; margin: 1rem; }
  button { display: block; width: 100%; margin: 0.5rem 0; padding: 0.9rem; font-size: 1rem; }
  pre { font-size: 11px; white-space: pre-wrap; word-break: break-all; background: #8881; padding: 0.5rem; }
</style></head>
<body>
<h1>iOS Safari permission check</h1>
<button id="motion">1. requestMotionPermission()</button>
<button id="orientation">2. requestOrientationPermission()</button>
<button id="no-gesture">3. requestMotionPermission() in 6 s, outside the tap</button>
<button id="copy">Copy results</button>
<pre id="out"></pre>
<script type="module">${source}</script>
</body></html>`

const tls =
    process.env.TLS_CERT && process.env.TLS_KEY
        ? { cert: Bun.file(process.env.TLS_CERT), key: Bun.file(process.env.TLS_KEY) }
        : undefined
const server = Bun.serve({
    port: Number(process.env.PORT ?? 3033),
    hostname: "0.0.0.0",
    tls,
    fetch: () => new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } }),
})
console.log(`iOS Safari check page: ${server.url} (${tls ? "HTTPS" : "HTTP — tunnel it over HTTPS"})`)
