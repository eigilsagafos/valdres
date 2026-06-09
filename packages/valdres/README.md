<!-- DOCS:START -->

# valdres

Fast atom-based state management for JavaScript. Inspired by Recoil and Jotai.

## Installation

```bash
npm install valdres
```

```ts
import { store, atom, selector } from "valdres"

const countAtom = atom(0)
const doubledSelector = selector(get => get(countAtom) * 2)

const s = store()
s.set(countAtom, 21)
s.get(doubledSelector) // 42
```

Part of [Valdres](https://valdres.dev) — reactive state management for React, Vue, Svelte, Solid, and Angular.

Full documentation: https://valdres.dev

<!-- DOCS:END -->
