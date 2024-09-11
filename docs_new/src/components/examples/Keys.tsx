import { useActiveKeyNames, useCommand, Command } from "../../../../hotkeys"
export const Keys = () => {
    const keys = useActiveKeyNames()
    useCommand(Command.Save, () => {
        console.log(`saving`)
    })
    return (
        <div>
            {keys.map(key => (
                <span
                    key={key}
                    style={{
                        border: "0.1px solid white",
                        padding: "2px 8px",
                        marginLeft: "4px",
                        borderRadius: "3px",
                        fontFamily: "monospace",
                    }}
                >
                    {key}
                </span>
            ))}
        </div>
    )
}
