import { watch } from "node:fs"
import { discover } from "./src/discover"
import { compileMdx } from "./src/compile-mdx"
import { renderPages } from "./src/render"

const rootDir = import.meta.dir.replace("/docs", "")
const docsDir = import.meta.dir
const distDir = `${docsDir}/dist`

const valdresVersion: string = (
    await Bun.file(`${rootDir}/packages/valdres/package.json`).json()
).version

type BuildKind = "mdx" | "layout" | "bundles"

const RELOAD_SCRIPT = `<script>
(function(){
  let ws;
  function connect(){
    ws = new WebSocket("ws://" + location.host + "/__dev");
    ws.onmessage = (e) => {
      if (e.data === "reload") location.reload();
      else if (e.data === "css") {
        for (const link of document.querySelectorAll("link[rel=stylesheet]")) {
          const u = new URL(link.href);
          u.searchParams.set("v", Date.now().toString());
          link.href = u.toString();
        }
      }
    };
    ws.onclose = () => setTimeout(connect, 500);
  }
  connect();
})();
</script>`

const reactDedup: import("bun").BunPlugin = {
    name: "react-dedup",
    setup(build) {
        const reactPkgs = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "react-dom/client"]
        for (const pkg of reactPkgs) {
            build.onResolve({ filter: new RegExp(`^${pkg.replace("/", "\\/")}$`) }, () => {
                return { path: require.resolve(pkg) }
            })
        }
    },
}

const sveltePlugin: import("bun").BunPlugin = {
    name: "svelte",
    async setup(build) {
        const { compile, compileModule } = await import("svelte/compiler")
        build.onLoad({ filter: /\.svelte\.[tj]s$/ }, async args => {
            const source = await Bun.file(args.path).text()
            const transpiler = new Bun.Transpiler({ loader: "ts" })
            const jsSource = transpiler.transformSync(source)
            const result = compileModule(jsSource, { filename: args.path, generate: "client" })
            return { contents: result.js.code, loader: "js" }
        })
        build.onLoad({ filter: /\.svelte$/ }, async args => {
            const source = await Bun.file(args.path).text()
            const result = compile(source, { filename: args.path, generate: "client", css: "injected" })
            return { contents: result.js.code, loader: "js" }
        })
    },
}

const defineDev = {
    "process.env.NODE_ENV": '"development"',
    "process.env.VALDRES_VERSION": JSON.stringify(valdresVersion),
}

async function bundleClient() {
    return Bun.build({
        entrypoints: [`${docsDir}/src/islands/client.ts`],
        outdir: distDir,
        naming: "client.js",
    })
}

async function bundleIslands() {
    return Bun.build({
        entrypoints: [
            `${docsDir}/src/islands/demos.ts`,
            `${docsDir}/src/islands/playground-bundle.tsx`,
        ],
        outdir: distDir,
        splitting: true,
        naming: { entry: "[name].js" },
        plugins: [reactDedup],
        define: defineDev,
    })
}

async function bundleLanding() {
    return Bun.build({
        entrypoints: [`${docsDir}/src/islands/landing.tsx`],
        outdir: distDir,
        naming: "landing.js",
        plugins: [reactDedup, sveltePlugin],
        define: defineDev,
    })
}

async function rebuildBundles() {
    const results = await Promise.all([
        bundleClient(),
        bundleIslands(),
        bundleLanding(),
    ])
    for (const r of results) {
        if (!r.success) for (const log of r.logs) console.error(log)
    }
}

async function rebuildPagesInline() {
    const entries = await discover(rootDir)
    const compiled = await compileMdx(entries)
    await renderPages(compiled, distDir)
}

async function rebuildPagesFresh() {
    const proc = Bun.spawn(["bun", "run", `${docsDir}/dev-render.ts`], {
        stdout: "inherit",
        stderr: "inherit",
    })
    const code = await proc.exited
    if (code !== 0) throw new Error(`dev-render exited with ${code}`)
}

const PORT = 4321

await new Promise<void>((resolve) => {
    const { createServer } = require("node:net") as typeof import("node:net")
    const probe = createServer()
    probe.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
            console.error(`❌ Port ${PORT} is already in use. Stop the other process and retry.`)
            process.exit(1)
        }
        resolve()
    })
    probe.once("listening", () => probe.close(() => resolve()))
    probe.listen(PORT, "0.0.0.0")
})

console.log("⚡ Starting dev server...")
const startTime = Date.now()

const tailwind = Bun.spawn(
    [
        "bunx", "@tailwindcss/cli",
        "-i", `${docsDir}/src/styles/globals.css`,
        "-o", `${distDir}/styles.css`,
        "--watch",
    ],
    { stdout: "ignore", stderr: "inherit" },
)

await Promise.all([rebuildBundles(), rebuildPagesInline()])
await Bun.write(`${distDir}/favicon.svg`, Bun.file(`${docsDir}/favicon.svg`))

console.log(`✅ Initial build in ${Date.now() - startTime}ms`)

const wsClients = new Set<{ send: (data: string) => void }>()
function broadcast(msg: string) {
    for (const ws of wsClients) {
        try { ws.send(msg) } catch {}
    }
}

let rebuildTimer: Timer | null = null
let rebuildRunning: Promise<void> | null = null
const pending = new Set<BuildKind>()

async function runRebuild() {
    while (pending.size > 0) {
        const kinds = [...pending]
        pending.clear()
        const t = Date.now()
        try {
            const tasks: Promise<unknown>[] = []
            if (kinds.includes("bundles")) tasks.push(rebuildBundles())
            if (kinds.includes("layout")) tasks.push(rebuildPagesFresh())
            else if (kinds.includes("mdx")) tasks.push(rebuildPagesInline())
            await Promise.all(tasks)
            console.log(`♻️  ${kinds.join("+")} in ${Date.now() - t}ms`)
            broadcast("reload")
        } catch (e) {
            console.error("Rebuild failed:", e)
        }
    }
}

function queueRebuild(kind: BuildKind) {
    pending.add(kind)
    if (rebuildTimer) return
    rebuildTimer = setTimeout(async () => {
        rebuildTimer = null
        if (rebuildRunning) await rebuildRunning
        rebuildRunning = runRebuild()
        await rebuildRunning
        rebuildRunning = null
    }, 80)
}

watch(`${rootDir}/packages`, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith(".mdx")) return
    if (filename.includes("node_modules")) return
    queueRebuild("mdx")
})

watch(`${docsDir}/content`, { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (filename.endsWith(".mdx")) queueRebuild("mdx")
    else if (filename.endsWith(".ts")) queueRebuild("layout")
})

watch(`${docsDir}/src`, { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (filename.endsWith(".mdx")) return
    if (filename.startsWith("islands/") || filename.startsWith("islands\\")) {
        queueRebuild("bundles")
    } else {
        queueRebuild("layout")
    }
})

watch(`${distDir}/styles.css`, () => broadcast("css"))

function contentType(path: string): Record<string, string> {
    if (path.endsWith(".css")) return { "content-type": "text/css; charset=utf-8" }
    if (path.endsWith(".js")) return { "content-type": "application/javascript; charset=utf-8" }
    if (path.endsWith(".svg")) return { "content-type": "image/svg+xml" }
    if (path.endsWith(".txt")) return { "content-type": "text/plain; charset=utf-8" }
    if (path.endsWith(".json")) return { "content-type": "application/json; charset=utf-8" }
    return { "content-type": "text/html; charset=utf-8" }
}

async function serveHtml(path: string) {
    const file = Bun.file(path)
    if (!(await file.exists())) return null
    const html = await file.text()
    const injected = html.replace("</body>", `${RELOAD_SCRIPT}</body>`)
    return new Response(injected, { headers: { "content-type": "text/html; charset=utf-8" } })
}

const server = Bun.serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url)

        if (url.pathname === "/__dev") {
            if (server.upgrade(req)) return undefined as any
            return new Response("websocket required", { status: 400 })
        }

        let path = url.pathname

        if (path.endsWith(".html") || !path.includes(".")) {
            const htmlPath = path.endsWith("/")
                ? `${distDir}${path}index.html`
                : path.endsWith(".html")
                    ? `${distDir}${path}`
                    : `${distDir}${path}/index.html`
            const res = await serveHtml(htmlPath)
            if (res) return res
        }

        const file = Bun.file(`${distDir}${path}`)
        if (await file.exists()) {
            return new Response(file, { headers: contentType(path) })
        }

        const indexRes = await serveHtml(`${distDir}${path}/index.html`)
        if (indexRes) return indexRes

        return new Response("Not Found", { status: 404 })
    },
    websocket: {
        open(ws) { wsClients.add(ws as any) },
        close(ws) { wsClients.delete(ws as any) },
        message() {},
    },
})

process.on("SIGINT", () => { tailwind.kill(); process.exit(0) })
process.on("SIGTERM", () => { tailwind.kill(); process.exit(0) })

console.log(`🚀 http://localhost:${server.port}`)
