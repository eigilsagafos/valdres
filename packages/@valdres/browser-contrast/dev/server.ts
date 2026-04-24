import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3023),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`@valdres/browser-contrast demo: ${server.url}`)
