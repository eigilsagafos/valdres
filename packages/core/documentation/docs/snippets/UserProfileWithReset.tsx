import { useResetAtom, useValue } from "valdres-react"
import { currentUserIdAtom } from "./state/atoms/currentUserIdAtom"
import { RenderIfClient } from "./components/RenderIfClient"
import { UserProfile } from "./UserProfile"

export const UserProfileWithReset = () => {
    const reset = useResetAtom(currentUserIdAtom)
    const userId = useValue(currentUserIdAtom)
    return (
        <RenderIfClient>
            <div style={{ display: "flex" }}>
                <UserProfile userId={userId} />
                <button style={{ marginLeft: "16px" }} onClick={reset}>
                    Reset
                </button>
            </div>
        </RenderIfClient>
    )
}
