import { atom, useResetValdresState, useValdresState } from "valdres-react"

const countAtom = atom(0)

export const Counter = () => {
    const [count, setCount] = useValdresState(countAtom)
    const increment = () => setCount(curr => curr + 1)
    const reset = useResetValdresState(countAtom)
    return (
        <div className="snippet">
            <button onClick={increment}>Increment</button>
            <button onClick={reset}>Reset</button>
            <div>Current count is {count}</div>
        </div>
    )
}
