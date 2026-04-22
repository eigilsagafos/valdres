import { $ } from "bun"

const distDir = `${import.meta.dir}/dist`

// Build first
console.log("Building docs...")
await import("./build.ts")

// Serve
const server = Bun.serve({
    port: 4321,
    async fetch(req) {
        const url = new URL(req.url)
        let path = url.pathname

        // Try exact file
        let file = Bun.file(`${distDir}${path}`)
        if (await file.exists()) {
            return new Response(file, {
                headers: contentType(path),
            })
        }

        // Try index.html for directory
        file = Bun.file(`${distDir}${path}/index.html`)
        if (await file.exists()) {
            return new Response(file, {
                headers: { "content-type": "text/html; charset=utf-8" },
            })
        }

        // Try with .html extension
        file = Bun.file(`${distDir}${path}.html`)
        if (await file.exists()) {
            return new Response(file, {
                headers: { "content-type": "text/html; charset=utf-8" },
            })
        }

        return new Response("Not Found", { status: 404 })
    },
})

function contentType(path: string): Record<string, string> {
    if (path.endsWith(".css"))
        return { "content-type": "text/css; charset=utf-8" }
    if (path.endsWith(".js"))
        return { "content-type": "application/javascript; charset=utf-8" }
    if (path.endsWith(".svg"))
        return { "content-type": "image/svg+xml" }
    if (path.endsWith(".txt"))
        return { "content-type": "text/plain; charset=utf-8" }
    if (path.endsWith(".wasm") || path.endsWith(".pagefind"))
        return { "content-type": "application/octet-stream" }
    if (path.endsWith(".json"))
        return { "content-type": "application/json; charset=utf-8" }
    if (path.endsWith(".pf_meta") || path.endsWith(".pf_fragment") || path.endsWith(".pf_index"))
        return { "content-type": "application/octet-stream" }
    return { "content-type": "text/html; charset=utf-8" }
}

console.log(`\n🚀 Docs server running at http://localhost:${server.port}`)
