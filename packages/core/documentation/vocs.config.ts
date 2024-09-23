import { defineConfig } from "vocs"

export default defineConfig({
    title: "Valdres",
    titleTemplate: "%s - Valdres",
    description:
        "Fast atom based state library for React and JavaScript. Inspired by but faster than Jotai and Recoil",
    baseUrl: "https://valdres.dev",
    font: {
        mono: { google: "Fira Code" },
        // mono: { google: "Source Code Pro" },
        // mono: { google: "Ubuntu Sans Mono" },
        // mono: { google: "Roboto Mono" },
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
            link: "/docs/valdres-react",
            match: "/docs/valdres-react/",
        },
        { text: "Vanilla JS", link: "/docs/valdres", match: "/docs/valdres/" },
    ],
    sidebar: [
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
            collapsed: true,
            items: [
                {
                    text: "Config",
                    link: "/docs/api/config",
                },
                {
                    text: "API",
                    collapsed: true,
                    items: [
                        {
                            text: "Config",
                            link: "/docs/api/config",
                        },
                    ],
                },
            ],
        },
    ],
})
