import { defineConfig } from "vocs"

export default defineConfig({
    title: "Valdres",
    titleTemplate: "%s - Valdres",
    description:
        "Fast atom based state library for React and JavaScript. Inspired by but faster than Jotai and Recoil",
    baseUrl: "https://valdres.dev",
    iconUrl: "/icon.svg",
    logoUrl: "/logo.svg",
    font: {
        mono: { google: "Fira Code" },
    },
    socials: [
        {
            icon: "github",
            link: "https://github.com/eigilsagafos/valdres",
        },
    ],
    topNav: [
        {
            text: "React",
            link: "/docs/react",
            match: "/docs/react/",
        },
        { text: "Vanilla JS", link: "/docs/vanilla", match: "/docs/vanilla/" },
    ],
    sidebar: {
        "/docs/vanilla": [
            {
                text: "Getting Started",
                link: "/getting-started",
            },
            {
                text: "About",
                link: "/example",
            },
            {
                text: "API",
                collapsed: false,
                items: [
                    {
                        text: "atom",
                        link: "/docs/vanilla/api/atom",
                    },
                    {
                        text: "selector",
                        link: "/docs/vanilla/api/selector",
                    },
                ],
            },
        ],
        "/docs/react": [
            {
                text: "Getting Started",
                link: "/getting-started",
            },
            {
                text: "Example",
                link: "/example",
            },
            {
                text: "API",
                collapsed: false,
                items: [
                    {
                        text: "atom",
                        link: "/docs/react/api/atom",
                    },
                    {
                        text: "selector",
                        link: "/docs/react/api/selector",
                    },
                    {
                        text: "useValdresValue",
                        link: "/docs/react/api/useValdresValue",
                    },
                    {
                        text: "useValdresState",
                        link: "/docs/react/api/useValdresState",
                    },
                    {
                        text: "useSetValdresState",
                        link: "/docs/react/api/useSetValdresState",
                    },
                    {
                        text: "useResetValdresState",
                        link: "/docs/react/api/useResetValdresState",
                    },
                    {
                        text: "useValdresStore",
                        link: "/docs/react/api/useValdresStore",
                    },
                    {
                        text: "ValdresProvider",
                        link: "/docs/react/api/ValdresProvider",
                    },
                ],
            },
            {
                text: "Packages",
                collapsed: false,
                items: [
                    {
                        text: "@valdres-react/color-mode",
                        collapsed: true,
                        items: [
                            {
                                text: "Getting Started",
                                link: "/docs/react/api/useValdresValue",
                            },
                        ],
                    },
                ],
            },
        ],
    },
})
// export { useValdresCallback } from "./src/useValdresCallback"
// export { useValdresValueWithDefault } from "./src/useValdresValueWithDefault"
// export { ValdresProvider } from "./src/ValdresProvider"
