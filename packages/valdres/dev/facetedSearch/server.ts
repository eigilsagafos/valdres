import index from "./index.html"

const server = Bun.serve({
    port: Number(process.env.PORT ?? 3021),
    development: true,
    routes: {
        "/": index,
    },
})

console.log(`faceted-search demo: ${server.url}`)
