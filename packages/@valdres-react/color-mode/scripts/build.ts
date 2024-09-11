import { build } from "bun"

await build({
    entrypoints: ["./index.ts"],
    outdir: "./dist",
    target: "browser",
    packages: "external",
    minify: true,
    format: "esm",
}).then(res => console.log(res))
