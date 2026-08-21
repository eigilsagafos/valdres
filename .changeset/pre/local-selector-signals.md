---
"valdres": patch
---

Give every selector evaluation its own lazily-created abort signal. Selectors
using default or rest option parameters now receive abortable signals, and a
selector may switch from a synchronous result to an asynchronous result without
being permanently classified as synchronous.
