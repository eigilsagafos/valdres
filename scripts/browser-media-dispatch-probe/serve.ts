/**
 * Real-browser counterpart to the Happy-DOM media suites.
 *
 * WHAT IT PROVES
 *   Two independent stores subscribe to `colorSchemeAtom`. The first store's
 *   subscriber throws on every notification. The DOM standard requires the host
 *   to report that exception and keep invoking the remaining listeners, so the
 *   second store must still observe every change. Happy-DOM 20.0.5 aborts
 *   dispatch instead, which is why the package suites model the standard
 *   explicitly through `changeReportingErrors()` rather than claiming the mock
 *   establishes it. This page is what establishes it, in a real engine.
 *
 * HOW IT DRIVES A NATIVE EVENT
 *   `prefers-color-scheme` is owned by the operating system and cannot be
 *   toggled from script. The probe therefore substitutes the query STRING for a
 *   viewport query and runs inside an iframe the parent resizes. `matches`,
 *   listener registration and event dispatch are all native and unmodified —
 *   only which question is being asked changed.
 *
 * WHAT IT DOES NOT PROVE
 *   Not an OS-settings end-to-end test, not a packed-artifact test (it bundles
 *   workspace source), and not a cross-engine matrix — it proves whatever engine
 *   you point at it. Run it in more than one browser if that is the claim you
 *   need.
 *
 *   bun run scripts/browser-media-dispatch-probe/serve.ts
 *   # then open the printed URL; the page asserts and prints PASS or FAIL.
 *
 * This is deliberately a manual harness: the repository has no browser-driving
 * dependency, and adding one is a decision for whoever owns CI cost. The page
 * writes its verdict to `#verdict` and the full result to `#result` as JSON, so
 * a future Playwright step needs only to load it and read those two nodes.
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

const FRAME_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>media probe frame</title></head>
<body><script type="module">${probeSource}</script></body></html>`

const PARENT_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>@valdres/browser-color-scheme — native dispatch probe</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; max-width: 60rem; }
  #frame { border: 1px solid #8884; height: 60px; width: 400px; display: block; }
  #verdict { font-size: 1.5rem; font-weight: 600; margin: 1rem 0; }
  .pass { color: #128a3c; }
  .fail { color: #c02626; }
  pre { background: #8881; padding: 1rem; border-radius: 6px; overflow: auto; }
</style>
</head>
<body>
<h1>Native <code>MediaQueryList</code> dispatch probe</h1>
<p>
  Two stores subscribe to <code>colorSchemeAtom</code>; the first store's
  subscriber always throws. The second store must still receive every change,
  and each failure must surface as <code>SubscriberNotificationError</code>
  carrying the original cause.
</p>
<div id="verdict">running…</div>
<pre id="result">…</pre>
<iframe id="frame" src="/frame"></iframe>
<script type="module">
const frame = document.getElementById("frame")
const verdict = document.getElementById("verdict")
const output = document.getElementById("result")
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

// Poll rather than wait on the iframe's load event. The event may already have
// fired before this module runs, and a child that loads but throws before
// installing window.mediaProbe never fires anything at all -- either way a bare
// load listener leaves the page stuck on "running…" instead of reporting the
// failure. Polling to a deadline always terminates, into PASS or FAIL.
const PROBE_READY_TIMEOUT_MS = 10000
const PROBE_POLL_INTERVAL_MS = 50
const waitForProbe = async () => {
    const deadline = Date.now() + PROBE_READY_TIMEOUT_MS
    for (;;) {
        const probe = frame.contentWindow?.mediaProbe
        if (probe) return probe
        if (Date.now() >= deadline) {
            const state = frame.contentDocument?.readyState ?? "unavailable"
            throw new Error(
                "the probe iframe did not install window.mediaProbe within " +
                    PROBE_READY_TIMEOUT_MS +
                    " ms (iframe readyState: " +
                    state +
                    "). Check the browser console for a module error in /frame.",
            )
        }
        await new Promise(resolve => setTimeout(resolve, PROBE_POLL_INTERVAL_MS))
    }
}

const fail = (message, detail) => {
    verdict.textContent = "FAIL — " + message
    verdict.className = "fail"
    output.textContent = JSON.stringify(detail ?? null, null, 2)
}

try {
    const probe = await waitForProbe()
    await settle()

    // 400px -> 1000px -> 400px, each a native viewport media change.
    frame.style.width = "1000px"
    await settle()
    frame.style.width = "400px"
    await settle()

    const result = probe.result()
    probe.cleanup()

    const problems = []
    if (result.listenerCount !== 2)
        problems.push("expected 2 native listeners, saw " + result.listenerCount)
    if (JSON.stringify(result.healthySeen) !== JSON.stringify(["dark", "light"]))
        problems.push("healthy store saw " + JSON.stringify(result.healthySeen) + ", expected [\\"dark\\",\\"light\\"]")
    if (result.healthyFinal !== "light")
        problems.push("healthy store settled on " + result.healthyFinal)
    if (result.failingFinal !== "light")
        problems.push("failing store settled on " + result.failingFinal)
    if (result.errors.length !== 2)
        problems.push("expected 2 reported errors, saw " + result.errors.length)
    if (!result.errors.every(e => e.name === "SubscriberNotificationError"))
        problems.push("reported errors were " + result.errors.map(e => e.name).join(", "))
    if (!result.errors.every(e => e.causes.some(c => c.includes("intentional media probe subscriber failure"))))
        problems.push("reported errors lost the original cause")

    output.textContent = JSON.stringify(result, null, 2)
    if (problems.length === 0) {
        verdict.textContent = "PASS — both stores updated despite the throwing subscriber"
        verdict.className = "pass"
    } else {
        verdict.textContent = "FAIL — " + problems.join("; ")
        verdict.className = "fail"
    }
} catch (error) {
    fail(String(error && error.message ? error.message : error))
}
</script>
</body>
</html>`

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3031),
    fetch(request) {
        const { pathname } = new URL(request.url)
        const html = pathname === "/frame" ? FRAME_HTML : PARENT_HTML
        return new Response(html, {
            headers: { "content-type": "text/html; charset=utf-8" },
        })
    },
})

console.log(`Native media dispatch probe: ${server.url}`)
console.log("Open it in a browser; the page prints PASS or FAIL and the raw result.")
