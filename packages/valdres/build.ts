await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    external: ["./package.json"],
    packages: "external",
})
