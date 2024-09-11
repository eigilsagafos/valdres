import { useState } from "react"
import { useCommand, Command } from "../../../../hotkeys"

export const UseCommandExample = () => {
    const [lastCommand, setLastCommand] = useState("")
    useCommand(Command.Save, () => setLastCommand(Command.Save))
    useCommand(Command.Copy, () => setLastCommand(Command.Copy))
    return <div>lastCommand: {lastCommand}</div>
}
