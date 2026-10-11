---
"valdres": minor
---

**Breaking: import `deepEqual` from `valdres`; the `valdres/equality` subpath is removed.**

```diff
-import { atom } from "valdres"
-import { deepEqual } from "valdres/equality"
+import { atom, deepEqual } from "valdres"
```

`deepEqual` itself is unchanged, and atoms and selectors still default to
`Object.is`. It ships in its own chunk, so bundles that never import it still
drop it. Importing `valdres/equality` now fails to resolve (Node reports
`ERR_PACKAGE_PATH_NOT_EXPORTED`, TypeScript reports TS2307).
