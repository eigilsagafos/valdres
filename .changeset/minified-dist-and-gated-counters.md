---
"valdres": patch
---

Publish a minified `dist`, and stop paying for benchmark-only counters in
production.

The build now minifies. Most consumers bundle valdres and would minify it
themselves, so the headline win is in the published package — `dist`
JavaScript drops from 53.2 KB to 36.3 KB gzip (−32%) and the packed tarball
from 111.8 KB to 96.9 KB gzip (−13%), which every install and every
CDN/unpkg fetch pays. Consumer bundles also shrink slightly (≈0.9%, e.g. the
`atom + selector + store` fixture 30,462 → 30,079 bytes gzip) because mangling
valdres's internals here beats what a bundler infers through the module graph.
Source maps are deliberately not shipped: they restore readable stack traces
through valdres internals but measured at +167% on the packed tarball
(97 KB → 299 KB gzip), which is the wrong default when only a rare consumer
steps through our internals.

Two `architectureInstrumentation` call sites were reachable in production
without an `IS_PROD` guard — `recordCommitPlanRun` in the commit engine (once
per commit, the hottest path in the engine) and the scheduler/liveness
allocation counters in the graph workspace pool. Both now sit behind
`!IS_PROD`, matching every other `record*` call site, so a production build
pays neither the call nor the `data.architectureInstrumentation` load. These
are test/benchmark-only structural counters that production code has no way to
enable, so no observable behavior changes.

The build-output tests now assert the `process.env.NODE_ENV` and engine
self-check contracts against the minified artifact that actually ships, with
structural chunk-placement assertions kept on an unminified build where
identifiers survive.
