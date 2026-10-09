/**
 * Real-browser counterpart to the Happy-DOM suites of the four
 * permission-gated packages: `@valdres/browser-device-motion`,
 * `-device-orientation`, `-geolocation` and `-screen-details`.
 *
 * WHAT IT PROVES, in whatever engine opens it
 *   - importing and subscribing make no permission request, start no watch
 *     and call no `getScreenDetails` (every native call is wrapped and logged
 *     with `navigator.userActivation.isActive` at call time);
 *   - each button's native call runs synchronously inside the click, i.e. with
 *     transient activation;
 *   - native event delivery across two stores when one store's subscriber
 *     always throws (the healthy store keeps updating);
 *   - per-Store geolocation watches, the conflict error, disposal releasing
 *     listeners and watches;
 *   - over plain `http://` to a non-loopback host, the "insecure" statuses.
 *
 * WHAT IT DOES NOT PROVE
 *   It bundles workspace source, not the packed artifact, and proves only the
 *   engine you point at it. Readings and positions come from whatever the
 *   browser provides: drive it with DevTools sensor and geolocation overrides
 *   (as the automated run in the PR did) to avoid real hardware or location.
 *
 *   bun run scripts/browser-permission-probe/serve.ts
 *   # open the printed URL; window.permissionProbe exposes each step and
 *   # snapshot(), and the buttons are the explicit, user-activated triggers.
 *
 * Deliberately a manual harness, like scripts/browser-media-dispatch-probe:
 * the repository has no browser-driving dependency.
 */
import { join } from "node:path"

const HERE = import.meta.dir

const bundle = await Bun.build({
    entrypoints: [join(HERE, "probe.ts")],
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
})
if (!bundle.success) {
    console.error("Failed to bundle the probe:")
    for (const log of bundle.logs) console.error(log)
    process.exit(1)
}
const probeSource = await bundle.outputs[0]!.text()

const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>@valdres browser-permission probe</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; max-width: 60rem; }
  button { margin: 0 0.5rem 0.5rem 0; }
</style>
</head>
<body>
<h1>Browser permission probe</h1>
<p>Status: <span id="status">loading…</span></p>
<div id="controls"></div>
<p>Open the console: <code>permissionProbe.subscribeAll()</code>, then use the
buttons and <code>permissionProbe.snapshot()</code>.</p>
<script type="module">${probeSource}</script>
</body>
</html>`

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3032),
    hostname: process.env.HOST ?? "127.0.0.1",
    fetch: () =>
        new Response(HTML, {
            headers: { "content-type": "text/html; charset=utf-8" },
        }),
})

console.log(`Browser permission probe: ${server.url}`)
