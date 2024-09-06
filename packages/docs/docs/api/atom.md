---
sidebar_position: 1
---

# atom

```jsx live noInline
const { atom, createStore, useValdresValue, getDefaultStore } = valdres
const mousePos = atom([0, 0])
const store = getDefaultStore()

document.addEventListener("mousemove", e => {
    store.set(mousePos, [e.x, e.y])
})

const Comp = () => {
    const [x, y] = useValdresValue(mousePos)
    return (
        <p>
            Your mouse position is x: {x} y: {y}
        </p>
    )
}

render(<Comp />)
```
