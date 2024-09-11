---
title: atom
sidebar:
    order: 1
---

An `atom` represents a piece of state in Valdres. It can store primitive values
like numbers, atoms and strings or complex values like arrays and objects. An
atom is initiated with a default value, a function to generate a default value
or if undefined the atom will return a promise that resolves when set.

## Example

```jsx
import { atom, createStore } from "valdres"

const countAtom = atom(0)
const store = createStore()
const increment = () => store.set(countAtom, curr => curr++)

store.get(countAtom) // 0
increment()
store.get(countAtom) // 1
```
