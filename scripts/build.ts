await Bun.build({
    entrypoints: ['./index.ts'],
    outdir: './out',
    target: "browser",
    packages: "external",
    minify: true, // default false
}).then(res => console.log(res))