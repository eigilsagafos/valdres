import type { ReactNode } from "react"
import * as Tabs from "@radix-ui/react-tabs"
// import * as styles from "vocs"
// HomePage.css.js

export const InstallPackage = ({
    name,
    type = "install",
}: {
    children: ReactNode
    className?: string
    name: string
    type?: "install" | "init"
}) => {
    return (
        <Tabs.Root className={styles.tabs} defaultValue="npm">
            <Tabs.List className={styles.tabsList}>
                <Tabs.Trigger value="npm">npm</Tabs.Trigger>
                <Tabs.Trigger value="pnpm">pnpm</Tabs.Trigger>
                <Tabs.Trigger value="yarn">yarn</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content className={styles.tabsContent} value="npm">
                <span className={styles.packageManager}>npm</span>{" "}
                {type === "init" ? "init" : "install"} {name}
            </Tabs.Content>
            <Tabs.Content className={styles.tabsContent} value="pnpm">
                <span className={styles.packageManager}>pnpm</span>{" "}
                {type === "init" ? "create" : "add"} {name}
            </Tabs.Content>
            <Tabs.Content className={styles.tabsContent} value="yarn">
                <span className={styles.packageManager}>yarn</span>{" "}
                {type === "init" ? "create" : "add"} {name}
            </Tabs.Content>
        </Tabs.Root>
    )
}
