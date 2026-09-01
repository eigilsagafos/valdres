---
"valdres": minor
---

Add the recording-neutral `StoreInspector.capture(store, state?)` seam so
opt-in framework inspection can correlate its own timelines with active Store
diagnostic context without recording application values or extra core events.
