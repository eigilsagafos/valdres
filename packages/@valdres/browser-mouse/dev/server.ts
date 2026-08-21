import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3028),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-mouse demo: ${server.url}`)
