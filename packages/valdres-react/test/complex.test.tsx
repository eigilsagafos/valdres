import { describe, expect, test } from "bun:test"
import { atomFamily, store, selector, selectorFamily } from "valdres"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useValue } from "../src/useValue"
import { Provider } from "../src/Provider"
import { useAtom } from "../src/useAtom"

const store1 = store()
const fileAtom = atomFamily<string, string>()
const directoryAtom = atomFamily<string[], string>([])
const directoryOpenAtom = atomFamily(true)

const structure = [
    [
        "Music",
        [
            [
                "Albums",
                [
                    [
                        "Awsome One",
                        [
                            "track1.mp3",
                            "track2.mp3",
                            "track3.mp3",
                            "track4.mp3",
                            "track5.mp3",
                            "track6.mp3",
                        ],
                    ],
                    [
                        "Awsome Two",
                        [
                            "track1.mp3",
                            "track2.mp3",
                            "track3.mp3",
                            "track4.mp3",
                            "track5.mp3",
                            "track6.mp3",
                        ],
                    ],
                ],
            ],
            [
                "Playlists",
                [
                    "playlist1.m3u",
                    "playlist2.m3u",
                    "playlist3.m3u",
                    "playlist4.m3u",
                ],
            ],
        ],
    ],
    [
        "Documents",
        [
            [
                "Work",
                [
                    [
                        "Foler1",
                        ["file1.pdf", "file2.pdf", "file3.pdf", "file4.pdf"],
                    ],
                    [
                        "Foler2",
                        ["file1.pdf", "file2.pdf", "file3.pdf", "file4.pdf"],
                    ],
                    [
                        "Foler3",
                        ["file1.pdf", "file2.pdf", "file3.pdf", "file4.pdf"],
                    ],
                    [
                        "Foler4",
                        ["file1.pdf", "file2.pdf", "file3.pdf", "file4.pdf"],
                    ],
                    "file1.pdf",
                    "file2.pdf",
                    "file3.pdf",
                    "file4.pdf",
                ],
            ],
        ],
    ],
    "photo.jpg",
    "document.pdf",
]

const recursivlyFindVisibleFiles = (get, directory) => {
    get(directoryAtom(directory)).flatMap()
}
const isDir = (string: string) => string.endsWith("/")

const recursivlyBuildFileList = (get, directory = "/") =>
    get(directoryAtom(directory)).flatMap(item => {
        if (isDir(item)) {
            return recursivlyBuildFileList(get, directory + item)
        } else {
            return directory + item
        }
    })

const fileListSelector = selector(get => recursivlyBuildFileList(get))

const visibleFileListSelector = selector(get =>
    get(fileListSelector).filter(file => get(fileVisibleSelector(file))),
)

const fileVisibleSelector = selectorFamily(file => get => {
    const folders = file.split("/").slice(1, -1)
    let current = "/"
    if (folders.length === 0) return get(directoryOpenAtom(current))
    for (const segment of folders) {
        current += segment + "/"
        if (get(directoryOpenAtom(current)) === false) return false
        return true
    }
})

const fileVisibleIndexSelector = selectorFamily(file => get => {
    const index = get(visibleFileListSelector).indexOf(file)
    if (index === -1) throw new Error(`Not found`)
    return index
})

const initAtoms = (items, currentDir = "/") => {
    store1.set(directoryAtom(currentDir), [])
    for (const item of items) {
        if (Array.isArray(item)) {
            const [folder, nestedItems] = item
            const nestedFolder = currentDir + folder + "/"
            store1.set(directoryAtom(currentDir), curr => [
                ...curr,
                folder + "/",
            ])
            initAtoms(nestedItems, nestedFolder)
        } else {
            store1.set(fileAtom(currentDir + item), { name: item })
            store1.set(directoryAtom(currentDir), curr => [...curr, item])
        }
    }
}

initAtoms(structure)

const Directory = ({ directory }) => {
    const [isOpen, setIsOpen] = useAtom(directoryOpenAtom(directory))
    console.log([directory, isOpen])
    const items = useValue(directoryAtom(directory))
    return (
        <div>
            <button
                data-testid={directory}
                onClick={() => {
                    setIsOpen(curr => !curr)
                    console.log(`dir`, directory)
                }}
            >
                toggle
            </button>
            <div
                data-testid={directory + "_" + (isOpen ? "open" : "collapsed")}
            >
                {directory}
            </div>
            {isOpen &&
                items.map(item => {
                    const key = directory + item
                    if (isDir(item)) {
                        return (
                            <Directory key={key} directory={directory + item} />
                        )
                    } else {
                        return (
                            <File key={key} directory={directory} file={item} />
                        )
                    }
                })}
        </div>
    )
}

const File = ({ directory, file }) => {
    const visibleIndex = useValue(fileVisibleIndexSelector(directory + file))
    // console.log(visibleIndex)
    return <div>{`[${visibleIndex}] ${directory + file}`}</div>
}

describe("sss", () => {
    test("asdfasdf", async () => {
        render(
            <Provider store={store1}>
                <Directory directory={"/"} />
            </Provider>,
        )
        await userEvent.click(screen.getByTestId("/Music/"))
        await screen.findByTestId("/Music/_collapsed")
        // const res = screen.getByTestId("/Musics/")
    })
})
