import { useState, useEffect, useMemo, useRef } from "react"
import * as valdres from "../../../../../valdres-react"
import * as jotai from "jotai"
import * as recoil from "recoil"

const HighlightReRender = ({ children }) => {
    const alertResetAt = useRef(Date.now())
    const [alert, setAlert] = useState(false)
    const [borderColor, setBorderColor] = useState("white")
    useEffect(() => {
        const now = Date.now()
        if (!alert && now - alertResetAt.current > 10) {
            setAlert(true)
        }
    })
    useEffect(() => {
        if (alert) {
            setBorderColor("red")
            setTimeout(() => {
                setBorderColor("white")
                alertResetAt.current = Date.now()
                setAlert(false)
            }, 300)
        }
    }, [alert])

    return (
        <div
            style={{
                borderColor,
                borderWidth: "0.5px",
                borderStyle: "solid",
                borderRadius: "4px",
                transition: "border 300ms ease-out",
            }}
        >
            {children}
        </div>
    )
}

const Atom = ({ atom, useValue }) => {
    const value = useValue(atom)
    console.log(`value`, value)
    return (
        <div style={{}}>
            <HighlightReRender>
                <div style={{ padding: "2px 10px" }}>{value}</div>
            </HighlightReRender>
        </div>
    )
}

const shuffle = array => {
    const newArr = [].concat(array)
    for (let i = newArr.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[newArr[i], newArr[j]] = [newArr[j], newArr[i]]
    }
    return newArr
}

// const numbersAtom = valdres.atom(numbers)

const RenderTest = ({ selectors, sum, useValue }) => {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                marginTop: 0,
                gap: "10px",
                fontFamily: "monospace",
            }}
        >
            {selectors.map((atom, i) => (
                <>
                    {i > 0 && <div>+</div>}
                    <Atom key={i} atom={atom} useValue={useValue} />
                </>
            ))}
            <div>=</div>
            <Atom atom={sum} useValue={useValue} />
        </div>
    )
}
const numbers = [1, 2, 3, 4, 5]
const valdresAtom = valdres.atom(numbers)
const valdresSelectors = numbers.map((_, index) =>
    valdres.selector(get => get(valdresAtom)[index]),
)
const valdresSum = valdres.selector(get => [
    valdresSelectors.reduce((sum, selector) => sum + get(selector), 0),
])

const jotaiAtom = jotai.atom(numbers)
const jotaiSelectors = numbers.map((_, index) =>
    jotai.atom(get => get(jotaiAtom)[index]),
)
const jotaiSum = jotai.atom(get => [
    jotaiSelectors.reduce((sum, selector) => sum + get(selector), 0),
])

const recoilAtom = recoil.atom({ key: "numbers", default: numbers })
const recoilSelectors = numbers.map((_, index) =>
    recoil.selector({
        key: `${index}`,
        get: ({ get }) => get(recoilAtom)[index],
    }),
)
const recoilSum = recoil.selector({
    key: "sum",
    get: ({ get }) => [
        recoilSelectors.reduce((sum, selector) => sum + get(selector), 0),
    ],
})

const state = {
    valdres: {
        atom: valdresAtom,
        selectors: valdresSelectors,
        sum: valdresSum,
        useValue: valdres.useValue,
    },
    jotai: {
        atom: jotaiAtom,
        selectors: jotaiSelectors,
        sum: jotaiSum,
        useValue: jotai.useAtomValue,
    },
    recoil: {
        atom: recoilAtom,
        selectors: recoilSelectors,
        sum: recoilSum,
        useValue: recoil.useRecoilValue,
    },
}

const Inner = () => {
    const setValdres = valdres.useSetAtom(state.valdres.atom)
    const setJotai = jotai.useSetAtom(state.jotai.atom)
    const setRecoil = recoil.useSetRecoilState(state.recoil.atom)
    return (
        <div>
            <button
                onClick={() => {
                    let now = Date.now()
                    let updatedArr
                    setValdres(curr => {
                        updatedArr = shuffle(curr)
                        return updatedArr
                    })
                    setJotai(updatedArr)
                    setRecoil(updatedArr)
                    // setValues(curr => shuffle(curr))
                }}
            >
                Shuffle numbers
            </button>
            <button
                onClick={() => {
                    let now = Date.now()
                    let updatedArr
                    setValdres(curr => {
                        updatedArr = curr.map(() =>
                            Math.floor(Math.random() * 10),
                        )
                        return updatedArr
                    })
                    setJotai(updatedArr)
                    setRecoil(updatedArr)
                    // setValues(curr => shuffle(curr))
                }}
            >
                Change numbers
            </button>
            <h4>Valdres</h4>
            <RenderTest {...state.valdres} />
            <h4>Jotai</h4>
            <RenderTest {...state.jotai} />
            <h4>Recoil</h4>
            <RenderTest {...state.recoil} />
        </div>
    )
}

export const ReRenders = () => {
    return (
        <div style={{ all: `unset` }}>
            <recoil.RecoilRoot>
                <Inner />
            </recoil.RecoilRoot>
        </div>
    )
}
