import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3018),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-focus demo: ${server.url}`)
