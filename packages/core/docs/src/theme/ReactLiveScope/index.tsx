import React from "react"
import * as valdres from "../../../../valdres-react"
import * as jotai from "jotai"
import * as recoil from "recoil"

const useAnimationFrame = callback => {
    const requestRef = React.useRef()
    const previousTimeRef = React.useRef()

    const animate = time => {
        if (previousTimeRef.current != undefined) {
            const deltaTime = time - previousTimeRef.current
            callback(deltaTime)
        }
        previousTimeRef.current = time
        requestRef.current = requestAnimationFrame(animate)
    }

    React.useEffect(() => {
        requestRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(requestRef.current)
    }, []) // Make sure the effect runs only once
}

const Dot = ({ selector, lib, count }) => {
    const value = lib.useValue(selector)
    const val = value % count
    const opacity = val * (100 / count)
    return (
        <div
            style={{
                display: `inline-block`,
                backgroundColor: `black`,
                width: "4px",
                height: "4px",
                borderRadius: "2px",
                opacity: `${opacity / 1}%`,
                margin: "1px",
            }}
        />
    )
}

const average = array => array.reduce((a, b) => a + b) / array.length

const FPS = () => {
    const last10fps = React.useRef([])
    const lastRender = React.useRef(Date.now())
    const thisRender = Date.now()
    const fps = 1000 / (thisRender - lastRender.current)
    lastRender.current = thisRender
    last10fps.current.push(fps)
    if (last10fps.current.length > 50) {
        last10fps.current.shift()
    }
    const fpsAverage = average(last10fps.current)
    return <>{fpsAverage.toFixed(1)} fps</>
}

const SelectorFPSGridInner = ({ count, lib }) => {
    const atom = React.useRef(lib.atom(1))
    const [num, setNum] = lib.useState(atom.current)
    const [selectors, setSelectors] = React.useState([])
    const columns = Math.round(Math.sqrt(count))
    React.useEffect(() => {
        setSelectors(
            Array.from({ length: count })
                .map((_, i) => lib.selector(get => get(atom.current) + i))
                .reverse(),
        )
    }, [count])

    useAnimationFrame(deltaTime => setNum(num => num + 1))

    return (
        <div style={{ display: "block" }}>
            <FPS />
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, 4px)`,
                    gap: "0px",
                    columnGap: "2px",
                }}
            >
                {selectors.map((selector, index) => (
                    <Dot
                        key={index}
                        selector={selector}
                        lib={lib}
                        count={count}
                    />
                ))}
            </div>
        </div>
    )
}
const SelectorFPSGrid = ({ count, lib }) => {
    return (
        <lib.Provider key={count}>
            <SelectorFPSGridInner count={count} lib={lib} />
        </lib.Provider>
    )
}

const randomString = (length = 20) => {
    let result = ""
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength),
        )
    }
    return result
}
const options = [64, 256, 1024, 4048, 16384]
const libs = ["Valdres", "Jotai", "Recoil"]

const libMap = {
    Valdres: {
        atom: v => valdres.atom(v),
        selector: v => valdres.selector(v),
        useValue: s => valdres.useValdresValue(s),
        useState: s => valdres.useValdresState(s),
        Provider: valdres.ValdresProvider,
    },
    Recoil: {
        atom: v => recoil.atom({ key: randomString(), default: v }),
        selector: v => {
            // console.log("creating selector")
            return recoil.selector({
                key: randomString(),
                get: ({ get }) => v(get),
            })
        },
        useValue: s => recoil.useRecoilValue(s),
        useState: s => recoil.useRecoilState(s),
        Provider: recoil.RecoilRoot,
    },
    Jotai: {
        atom: v => jotai.atom(v),
        selector: v => jotai.atom(v),
        useValue: s => jotai.useAtomValue(s),
        useState: s => jotai.useAtom(s),
        Provider: jotai.Provider,
    },
}

const CompareFPS = () => {
    const [selectorCount, setSelectorCount] = React.useState(1024)
    const [selectedLib, setSelectedLib] = React.useState("Valdres")
    return (
        <div>
            Number of selectors
            <select onChange={e => setSelectorCount(e.target.value)}>
                {options.map(opt => (
                    <option
                        key={opt}
                        value={opt}
                        selected={selectorCount === opt}
                    >
                        {opt}
                    </option>
                ))}
            </select>
            <select onChange={e => setSelectedLib(e.target.value)}>
                {libs.map(lib => (
                    <option
                        key={lib}
                        value={lib}
                        selected={lib === selectedLib}
                    >
                        {lib}
                    </option>
                ))}
            </select>
            <SelectorFPSGrid lib={libMap[selectedLib]} count={selectorCount} />
        </div>
    )
}

// Add react-live imports you need here
const packages = {
    "@valdres/react": valdres,
}

const ReactLiveScope = {
    React,
    ...React,
    // valdres,
    // jotai,
    // recoil,
    CompareFPS,
    // ...valdres,
    require: lib => packages[lib],
}

export default ReactLiveScope
