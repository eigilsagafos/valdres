import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3016),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-screen demo: ${server.url}`)
