import { useEffect } from "react"
import { Command, MacCommands } from "./Command"
import { registerCallback } from "./registerCallback"
import { registerListeners } from "./registerListeners"

export const useCommand = (commandName: Command, callback) => {
    registerListeners()
    const command = MacCommands[commandName]
    if (!command) {
        throw new Error("Unsupported command")
    }
    useEffect(() => registerCallback(command, callback), [command, callback])
}
