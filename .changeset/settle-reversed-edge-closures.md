---
"valdres": patch
---

Fix a false `SelectorCircularDependencyError`, and rarer stale values, after one
commit reverses a dependency between cached selectors. Settlement now evaluates
the new graph instead of trusting edges the commit made obsolete, so cached
selectors agree with a fresh Store. A selector that reports a real cycle now
recovers once a later commit breaks that cycle anywhere along it, instead of
staying failed until one of its own earlier reads changes. While a subscription
reaches such a cycle, the external sources read along it stay subscribed, so a
source change that breaks the cycle notifies the subscriber; they unsubscribe
when the last such subscription ends or its Store is disposed.
