import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3015),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-window-management demo: ${server.url}`)
