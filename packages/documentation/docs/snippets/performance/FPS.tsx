import { useEffect, useState } from "react"
import * as valdres from "valdres"
import * as valdresReact from "valdres-react"
import * as jotai from "jotai"
import * as jotaiUtils from "jotai/utils"
import * as recoil from "recoil"

const getLocalStorage = key => {
    const res = localStorage.getItem(key)
    if (res) return JSON.parse(res)
}
const setLocalStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value))
}

const libs = {
    valdres: {
        atom: valdres.atom,
        selector: valdres.selector,
        useValue: valdresReact.useValue,
        useAtom: valdresReact.useAtom,
        useSetAtom: valdresReact.useSetAtom,
        Provider: valdresReact.Provider,
    },
    jotai: {
        atom: (defaultValue, name) => {
            const atom =
                typeof defaultValue === "function"
                    ? jotaiUtils.atomWithDefault(defaultValue)
                    : jotai.atom(defaultValue)

            atom.debugLabel = name
            return atom
        },
        selector: (get, name) => {
            const atom = jotai.atom(get)
            atom.debugLabel = name
            return atom
        },
        useValue: jotai.useAtomValue,
        useAtom: jotai.useAtom,
        useSetAtom: jotai.useSetAtom,
        Provider: jotai.Provider,
    },
    recoil: {
        atom: (defaultValue, name: string) =>
            recoil.atom({
                default:
                    typeof defaultValue === "function"
                        ? recoil.selector({
                              get: () => defaultValue(),
                              key: name + "_default_selector",
                          })
                        : defaultValue,
                key: name,
            }),
        selector: (fn, name) =>
            recoil.selector({ get: ({ get }) => fn(get), key: name }),
        useValue: recoil.useRecoilValue,
        useAtom: recoil.useRecoilState,
        useSetAtom: recoil.useSetRecoilState,
        Provider: recoil.RecoilRoot,
    },
}

const Dot = ({ selector, libName }: { selector: typeof sizeAtom; libName }) => {
    const lib = libs[libName]
    const opacity = lib.useValue(selector)
    return (
        <div
            style={{
                padding: "1px",
            }}
        >
            <div
                style={{
                    backgroundColor: "var(--vocs-color_text)",
                    opacity: opacity,
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                }}
            ></div>
        </div>
    )
}

const timestamps: number[] = []

const animate = (now: number, setFps, setCount, setFrameId) => {
    timestamps.unshift(now)
    if (timestamps.length > 10) {
        var t0 = timestamps.pop()
        setFps((1000 * 10) / (now - t0))
        setCount(current => (current += 1))
    }
    setFrameId(
        requestAnimationFrame(now =>
            animate(now, setFps, setCount, setFrameId),
        ),
    )
}

const FPSNumber = ({ libName }) => {
    const lib = libs[libName]
    const libState = libStates[libName]
    const value = lib.useValue(libState.fpsAtom)
    return <div>{Math.round(value * 100) / 100}</div>
}

const sizes = [8, 16, 32, 64, 96, 128]

const createLibState = libName => {
    const lib = libs[libName]
    const sizeAtom = lib.atom(
        () => getLocalStorage("snippets:performance:fps:size") || sizes[1],
        "sizeAtom",
    )
    return {
        sizeAtom,
        countAtom: lib.atom(0, "countAtom"),
        fpsAtom: lib.atom(null, "fpsAtom"),
        totalCountSelector: lib.selector(
            get => get(sizeAtom) * get(sizeAtom),
            "totalCountSelector",
        ),
    }
}

const libStates = {
    jotai: createLibState("jotai"),
    valdres: createLibState("valdres"),
    recoil: createLibState("recoil"),
}

const Inner = ({ libName }) => {
    const lib = libs[libName]
    const libState = libStates[libName]
    const size = lib.useValue(libState.sizeAtom)
    const setFps = lib.useSetAtom(libState.fpsAtom)
    const setCount = lib.useSetAtom(libState.countAtom)
    const selectors = Array.from({ length: size * size }).map((_, index) => [
        index,
        lib.selector(get => {
            const totalCount = get(libState.totalCountSelector)
            const iteration = get(libState.countAtom)
            const num = (iteration + index) % totalCount
            return (1 / totalCount) * num
        }, `sel_${index}`),
    ])

    useEffect(() => {
        let frameId: string
        const setFrameId = (id: string) => {
            frameId = id
        }
        const frame = requestAnimationFrame(now =>
            animate(now, setFps, setCount, setFrameId),
        )
        return () => cancelAnimationFrame(frameId)
    }, [setFps, setCount])

    return (
        <div>
            FPS Test
            <FPSNumber libName={libName} />
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${size}, 7px)`,
                }}
            >
                {selectors.map(([index, selector]) => (
                    <Dot key={index} selector={selector} libName={libName} />
                ))}
            </div>
        </div>
    )
}

const SizeSelect = ({ libName }) => {
    const lib = libs[libName]
    const libState = libStates[libName]
    const [size, setSize] = lib.useAtom(libState.sizeAtom)
    return (
        <>
            <label htmlFor="library">Grid size:</label>
            <select
                name="gridSize"
                onChange={e => {
                    const newVal = Number(e.target.value)
                    setSize(newVal)
                    setLocalStorage("snippets:performance:fps:size", newVal)
                    // console.log(typeof e.target.value)
                    // setLibName(e.target.value)
                }}
                defaultValue={String(size)}
            >
                {sizes.map(size => {
                    return (
                        <option key={size} value={size}>
                            {size}x{size}
                        </option>
                    )
                })}
            </select>
        </>
    )
}

export const FPS = () => {
    const [libName, setLibName] = useState(
        getLocalStorage("snippets:performance:fps:lib") || "valdres",
    )
    const lib = libs[libName]

    return (
        <lib.Provider>
            <label htmlFor="library">Choose a car:</label>
            <select
                name="library"
                id="library"
                onChange={e => {
                    setLocalStorage(
                        "snippets:performance:fps:lib",
                        e.target.value,
                    )
                    setLibName(e.target.value)
                }}
                defaultValue={libName}
            >
                <option value="valdres">Valdres</option>
                <option value="jotai">Jotai</option>
                <option value="recoil">Recoil</option>
            </select>
            <SizeSelect libName={libName} />
            <Inner libName={libName} />
        </lib.Provider>
    )
}
