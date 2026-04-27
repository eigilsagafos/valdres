import { useEffect, useState } from "react"
import { Sandpack, type SandpackTheme } from "@codesandbox/sandpack-react"

type Props = {
    code: string
    dependencies?: Record<string, string>
}

function useHtmlTheme(): "light" | "dark" {
    const [theme, setTheme] = useState<"light" | "dark">(() =>
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
            ? "dark"
            : "light",
    )
    useEffect(() => {
        const el = document.documentElement
        const observer = new MutationObserver(() => {
            setTheme(el.classList.contains("dark") ? "dark" : "light")
        })
        observer.observe(el, { attributes: true, attributeFilter: ["class"] })
        return () => observer.disconnect()
    }, [])
    return theme
}

const sharedSyntax = {
    keyword: "oklch(0.7 0.18 80)",
    tag: "oklch(0.75 0.16 80)",
    definition: "oklch(0.65 0.15 260)",
    property: "oklch(0.65 0.15 160)",
    static: "oklch(0.65 0.15 300)",
    string: "oklch(0.65 0.15 140)",
}

const lightTheme: SandpackTheme = {
    colors: {
        surface1: "oklch(0.985 0.003 80)",
        surface2: "oklch(0.955 0.006 80)",
        surface3: "oklch(0.93 0.005 80)",
        disabled: "oklch(0.65 0.01 80)",
        base: "oklch(0.3 0.008 260)",
        clickable: "oklch(0.45 0.008 260)",
        hover: "oklch(0.25 0.008 260)",
        accent: "oklch(0.6 0.16 80)",
    },
    syntax: {
        plain: "oklch(0.3 0.008 260)",
        comment: { color: "oklch(0.55 0.005 80)", fontStyle: "italic" },
        ...sharedSyntax,
        punctuation: "oklch(0.45 0.008 260)",
    },
    font: {
        body: "Inter, ui-sans-serif, system-ui, sans-serif",
        mono: "'JetBrains Mono', ui-monospace, monospace",
        size: "13px",
        lineHeight: "1.6",
    },
}

const darkTheme: SandpackTheme = {
    ...lightTheme,
    colors: {
        surface1: "oklch(0.185 0.008 260)",
        surface2: "oklch(0.215 0.008 260)",
        surface3: "oklch(0.28 0.008 260)",
        disabled: "oklch(0.5 0.008 260)",
        base: "oklch(0.85 0.006 80)",
        clickable: "oklch(0.7 0.006 80)",
        hover: "oklch(0.95 0.006 80)",
        accent: "oklch(0.75 0.16 80)",
    },
    syntax: {
        plain: "oklch(0.88 0.006 80)",
        comment: { color: "oklch(0.55 0.01 260)", fontStyle: "italic" },
        ...sharedSyntax,
        punctuation: "oklch(0.7 0.006 80)",
    },
}

const previewStylesLight = `body {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: oklch(0.985 0.003 80);
  color: oklch(0.3 0.008 260);
  margin: 0;
  padding: 1.5rem;
  -webkit-font-smoothing: antialiased;
}
button {
  font: inherit;
}`

const previewStylesDark = `body {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: oklch(0.185 0.008 260);
  color: oklch(0.88 0.006 80);
  margin: 0;
  padding: 1.5rem;
  -webkit-font-smoothing: antialiased;
}
button {
  font: inherit;
}`

export function Playground({ code, dependencies }: Props) {
    const theme = useHtmlTheme()

    return (
        <div className="my-6 not-prose lg:-mx-12 xl:-mx-24 2xl:-mx-40">
            <Sandpack
                template="react-ts"
                theme={theme === "dark" ? darkTheme : lightTheme}
                files={{
                    "/App.tsx": code,
                    "/styles.css":
                        theme === "dark"
                            ? previewStylesDark
                            : previewStylesLight,
                }}
                customSetup={{
                    dependencies: {
                        "valdres-react": "latest",
                        ...dependencies,
                    },
                }}
                options={{
                    showNavigator: false,
                    showLineNumbers: true,
                    showTabs: false,
                    editorHeight: 440,
                    editorWidthPercentage: 55,
                }}
            />
        </div>
    )
}
