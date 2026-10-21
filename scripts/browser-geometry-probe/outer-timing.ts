/**
 * Measures when `outerWidth` / `outerHeight` catch up after a window
 * `resize` in Chromium: the animation-frame index (1 = the first callback
 * after the event) and milliseconds, for twelve `Browser.setWindowBounds`
 * resizes. This is the data behind @valdres/browser-window's re-measurements
 * on frames 2-4. Manual: it reports, it does not assert.
 *
 *   bun run scripts/browser-geometry-probe/outer-timing.ts
 *   HEADED=1 CHROME=/path/to/chrome bun run scripts/browser-geometry-probe/outer-timing.ts
 */
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
const chrome =
    process.env.CHROME ??
    join(
        homedir(),
        "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    )
const html = `<script>
window.log = []
addEventListener("resize", () => {
  const t0 = performance.now(), target = [innerWidth, innerHeight]
  const e = { inner: target, outerAtEvent: [outerWidth, outerHeight], frame: null, ms: null }
  log.push(e)
  let n = 0
  const tick = () => { n++; if (e.frame === null && (outerWidth !== e.outerAtEvent[0] || outerHeight !== e.outerAtEvent[1])) { e.frame = n; e.ms = Math.round(performance.now() - t0) } if (n < 30) requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
  const check = () => { if (e.firstTimer === undefined && (outerWidth !== e.outerAtEvent[0] || outerHeight !== e.outerAtEvent[1])) e.firstTimer = Math.round(performance.now() - t0); else if (performance.now() - t0 < 1000) setTimeout(check, 1) }
  check()
})
</script>`
const server = Bun.serve({
    port: 0,
    fetch: () =>
        new Response(html, { headers: { "content-type": "text/html" } }),
})
const profile = mkdtempSync(join(tmpdir(), "outer2-"))
const proc = Bun.spawn(
    [
        chrome,
        ...(process.env.HEADED ? [] : ["--headless=new"]),
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--window-size=1200,900",
        "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
)
const pf = join(profile, "DevToolsActivePort")
while (!existsSync(pf)) await Bun.sleep(50)
const [port, path] = readFileSync(pf, "utf8").trim().split("\n")
const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`)
await new Promise(r => (ws.onopen = r))
let id = 0
const pend = new Map()
ws.onmessage = m => {
    const d = JSON.parse(String(m.data))
    if (d.id && pend.has(d.id)) {
        pend.get(d.id)(d.result ?? d)
        pend.delete(d.id)
    }
}
const send = (method: string, params = {}, sessionId?: string): Promise<any> =>
    new Promise(r => {
        const i = ++id
        pend.set(i, r)
        ws.send(JSON.stringify({ id: i, method, params, sessionId }))
    })
const { targetId } = await send("Target.createTarget", { url: server.url.href })
const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
})
await Bun.sleep(500)
const { windowId } = await send("Browser.getWindowForTarget", { targetId })
const sizes = [
    [900, 700],
    [1000, 800],
    [700, 500],
    [1100, 850],
    [800, 600],
    [1200, 900],
    [950, 650],
    [850, 750],
    [1050, 700],
    [750, 550],
    [1150, 800],
    [900, 700],
]
for (const [w, h] of sizes) {
    await send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: w, height: h },
    })
    await Bun.sleep(700)
}
const r = await send(
    "Runtime.evaluate",
    { expression: "JSON.stringify(log)", returnByValue: true },
    sessionId,
)
const log = JSON.parse(r.result.value).filter(
    (e: any) => e.inner[0] !== 1200 || e.frame !== null,
)
console.log(
    (await send("Browser.getVersion")).product,
    process.env.HEADED ? "headed" : "headless",
)
console.log(
    " frames to catch-up:",
    log.map((e: any) => e.frame ?? "never/no-change").join(" "),
)
console.log(" ms (rAF observed):", log.map((e: any) => e.ms).join(" "))
console.log(
    " ms (1ms timer poll):",
    log.map((e: any) => e.firstTimer).join(" "),
)
proc.kill()
server.stop(true)
