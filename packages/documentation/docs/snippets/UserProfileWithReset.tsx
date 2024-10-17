import { useResetAtom, useValue, Provider } from "valdres-react"
import { currentUserIdAtom } from "./state/atoms/currentUserIdAtom"
import { RenderIfClient } from "./components/RenderIfClient"
import { UserProfile } from "./UserProfile"

const Inner = () => {
    const reset = useResetAtom(currentUserIdAtom)
    const userId = useValue(currentUserIdAtom)

    return (
        <div style={{ display: "flex" }}>
            <UserProfile userId={userId} />
            <button style={{ marginLeft: "16px" }} onClick={reset}>
                Reset
            </button>
        </div>
    )
}
export const UserProfileWithReset = () => {
    return (
        <RenderIfClient>
            <Provider>
                <Inner />
            </Provider>
        </RenderIfClient>
    )
}
