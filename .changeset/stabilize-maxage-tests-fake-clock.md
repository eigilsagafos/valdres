---
---

Test-only: stabilize the flaky maxAge / staleWhileRevalidate / staleIfError
tests by replacing real wall-clock waits (`setInterval` + `await wait(N)`) with
a deterministic fake clock (`jest.useFakeTimers()`, which also fakes
`Date.now()`). Adds `test/utils/fakeClock.ts` (`useFakeClock` / `withFakeClock`
/ `mockAsyncSource`) and migrates the timing tests in `atom.test.ts` and
`cacheMeta.test.ts`. No library code changes — no release.
