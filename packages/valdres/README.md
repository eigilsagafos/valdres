<!-- DOCS:START -->

# valdres

The first public beta of Valdres's new synchronous state engine.

## Installation

```bash
npm install valdres@beta
```

```ts
import { store, atom, selector } from "valdres"

const countAtom = atom(0)
const doubledSelector = selector(get => get(countAtom) * 2)

const s = store()
s.set(countAtom, 21)
s.get(doubledSelector) // 42
```

`set` always stores the exact value you pass, including functions. Use `update` when the next value depends on the current value:

```ts
s.set(countAtom, 1)
s.update(countAtom, current => current + 1)
```

A store also exposes `sub`, `reset`, `txn`, `scope`, and `dispose`. Store operations are stable bound functions, so they can be passed as callbacks without rebinding.

`atom(initial, options)` and `atom.lazy(initialize, options)` create writable state. `selector(read, options)` creates synchronous derived state. Atom and selector options accept an inert diagnostic `name` and an `equal(previous, next)` comparator.

The versioned `valdres/adapter-internals/v1` entry is for framework bindings. It exports only `assertStore`, `read`, `subscribe`, and `readHydrationSnapshot`; application code should use Store methods directly.

## Beta compatibility

The `1.1.0-beta` line intentionally replaces the legacy `1.0.0-beta` API. It currently certifies the core package and `valdres-react`; the other framework adapters and plugin packages remain on the legacy line until they are migrated.

<!-- DOCS:END -->
