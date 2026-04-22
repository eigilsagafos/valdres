import { defineConfig } from "vite"

export default defineConfig({
    define: {
        "process.env.VALDRES_VERSION": JSON.stringify("dev"),
    },
})
