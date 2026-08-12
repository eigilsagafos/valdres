---
"valdres": patch
---

Add a folded `production` JavaScript graph so Vite and webpack production
builds can drop the freeze and architecture counters.

`IS_PROD` is rewritten to the literal `true` at every use site in
`exports.production`. An imported `const IS_PROD = true` is not enough — the
bundler does not fold that binding across modules. The default `import` graph
still honors runtime `NODE_ENV` (and process-less runtimes still default to
production). `exports.development` keeps the process-less development
fallback. The packed package grows because it now ships the extra graph.
