---
"valdres": patch
---

Default process-less CDN and edge runtimes to production mode so accepted writes
skip development-only deep-freezing, validation diagnostics, warnings, and
instrumentation. Bundlers can enable the `development` export condition, and
CDN consumers can import `valdres/development`, to retain those checks while
debugging a process-less runtime. Environments with `process.env` continue to
honor `NODE_ENV`.
