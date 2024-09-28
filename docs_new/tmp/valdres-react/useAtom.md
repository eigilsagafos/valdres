---
title: useAtom
sidebar:
    order: 1
---

Similar to Reacts `useState`. Returns an array with the value of a state object
and a function to set the value. Use with atoms only.

```jsx
import { atom, useAtom } from "@react/valdres"

const countAtom = atom(0)

const Comp = () => {
    const [count, setCount] = useState(countAtom)
    return (
        <div>
            <div>Count: {count}</div>
            <button onClick={curr => curr++}>Incrememnt</button>
        </div>
    )
}
```
