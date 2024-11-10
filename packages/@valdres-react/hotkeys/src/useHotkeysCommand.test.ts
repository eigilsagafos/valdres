import { describe, expect, mock, test } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import userEvent from "@testing-library/user-event"
import { useHotkeysCommand } from "./useHotkeysCommand"
import { globalStore } from "valdres"
import { Provider } from "valdres-react"
import { eventByKeyAtom } from "@valdres/hotkeys"

describe("useHotkeysCommand", async () => {
    test("foo", async () => {
        const user = userEvent.setup()

        const callback = mock(() => {})

        const { result, unmount } = renderHook(
            () =>
                useHotkeysCommand(
                    "Save",
                    callback,
                    { preventDefault: true },
                    [],
                ),
            { wrapper: Provider },
        )
        expect(globalStore.get(eventByKeyAtom)).toStrictEqual([
            ["Control", "s"],
        ])
        expect(callback).toHaveBeenCalledTimes(0)
        await user.keyboard("{Control>}{s}")
        expect(callback).toHaveBeenCalledTimes(1)
        unmount()
        expect(globalStore.get(eventByKeyAtom)).toStrictEqual([
            ["Control", "s"],
            ["Control"],
        ])
    })
})
