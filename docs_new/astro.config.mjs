// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import react from "@astrojs/react"

// https://astro.build/config
export default defineConfig({
    integrations: [
        react(),
        starlight({
            title: "Valdres",
            social: {
                github: "https://github.com/eigilsagafos/valdres",
            },
            sidebar: [
                {
                    label: "Getting Started",
                    items: [
                        { label: "Quick Start", slug: "" },
                        { label: "About", slug: "about" },
                    ],
                },
                // {
                //     label: "Core Packages",
                //     items: [
                //         {
                //             label: "valdres",
                //             collapsed: true,
                //             autogenerate: { directory: "valdres" },
                //         },
                //         {
                //             label: "valdres-react",
                //             collapsed: true,
                //             autogenerate: { directory: "reference/react" },
                //         },
                //     ],
                // },
                // {
                //     label: "Utility Packages",
                //     items: [
                //         {
                //             label: "@valdres",
                //             collapsed: true,
                //             items: [],
                //         },
                //         {
                //             label: "@valdres-react",
                //             collapsed: true,
                //             items: [
                //                 {
                //                     label: "hotkeys",
                //                     collapsed: true,
                //                     autogenerate: {
                //                         directory: "reference/react",
                //                     },
                //                 },
                //             ],
                //         },
                //     ],
                // },
            ],
        }),
    ],
})
