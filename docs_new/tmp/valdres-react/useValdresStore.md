---
title: useValdresStore
sidebar:
    order: 4
---

A hook that returns the closest Valdres store object. If wrapped within a
ValdresProvider it will return the store else it will return the default store
same as getDefaultStore.

## Example

```jsx
import { atom, useValdresStore } from "@valdres/store"

const userAtom = atom({ name: "Foo" })
const isSavingAtom = atom(false)

export const Comp = () => {
    const store = useValdresStore()

    return (
        <button
            onClick={() => {
                store.txn(set => {
                    set(userAtom, { name: "Bar" })
                    set(isSavingAtom, true)
                })
            }}
        >
            Save
        </button>
    )
}
```
