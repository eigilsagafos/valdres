import { useValue } from "valdres-react"
import { userDisplayNameSelector } from "./state/selectors/userDisplayNameSelector"
import { UserAvatar } from "./UserAvatar"

export function UserProfile({ userId }: { userId: string }) {
    const displayName = useValue(userDisplayNameSelector(userId))
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                height: "40px",
                width: "fit-content",
                border: "0.5px solid gray",
                padding: "8px 12px",
                borderRadius: "5px",
            }}
        >
            <UserAvatar userId={userId} />
            <span style={{ marginLeft: "8px" }}>{displayName}</span>
        </div>
    )
}
