import { atom, useResetAtom, useAtom } from "valdres-react"

const countAtom = atom(0)

export const Counter = () => {
    const [count, setCount] = useAtom(countAtom)
    const increment = () => setCount(curr => curr + 1)
    const reset = useResetAtom(countAtom)
    return (
        <div className="snippet">
            <button onClick={increment}>Increment</button>
            <button onClick={reset}>Reset</button>
            <div>Current count is {count}</div>
        </div>
    )
}
