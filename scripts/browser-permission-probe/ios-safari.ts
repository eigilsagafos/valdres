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

// The packages are bundled once, here: restart this server after changing
// them. The build stamp makes a stale bundle visible in the copied results.
const git = (...args: string[]) =>
    Bun.spawnSync(["git", ...args], { cwd: import.meta.dir }).stdout.toString().trim()
const build = {
    commit: git("rev-parse", "--short", "HEAD"),
    dirty: git("status", "--porcelain", "--", "packages") !== "",
    bundledAt: new Date().toISOString(),
}
const bundle = await Bun.build({
    entrypoints: [join(import.meta.dir, "ios-safari-page.ts")],
    target: "browser",
    define: {
        "process.env.NODE_ENV": JSON.stringify("development"),
        __IOS_CHECK_BUILD__: JSON.stringify(build),
    },
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
  #state { font-weight: 600; padding: 0.5rem; border-radius: 6px; background: #fd03; }
  pre { font-size: 11px; white-space: pre-wrap; word-break: break-all; background: #8881; padding: 0.5rem; }
</style></head>
<body>
<h1>iOS Safari permission check</h1>
<p id="state"></p>
<button id="no-gesture">C · Motion request 6 s after the tap (no gesture)</button>
<button id="motion">A · Motion request inside the tap</button>
<button id="orientation">B · Orientation request inside the tap</button>
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
console.log(`build ${build.commit}${build.dirty ? " (+uncommitted package changes)" : ""} at ${build.bundledAt}`)
console.log(`iOS Safari check page: ${server.url} (${tls ? "HTTPS" : "HTTP — tunnel it over HTTPS"})`)
