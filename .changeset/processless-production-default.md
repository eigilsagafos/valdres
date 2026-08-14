---
"valdres": patch
---

Default process-less CDN and edge runtimes to production mode so accepted writes
skip development-only deep-freezing, validation diagnostics, warnings, and
instrumentation. To retain those checks while debugging a process-less runtime,
bundlers can enable the `development` export condition; no-build CDN consumers
can load the development dist entry directly. The condition must be applied
consistently when framework adapters are present. Environments with
`process.env` continue to honor `NODE_ENV`.
