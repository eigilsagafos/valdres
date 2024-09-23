import { themes as prismThemes } from "prism-react-renderer"
import type { Config } from "@docusaurus/types"
import type * as Preset from "@docusaurus/preset-classic"

const config: Config = {
    title: "Valdres State Management",
    tagline: "Faster than Recoil and more Recoil than Jotai",
    favicon: "img/valdres.svg",
    url: "https://valdres.dev",
    baseUrl: "/",
    organizationName: "eigilsagafos", // Usually your GitHub org/user name.
    projectName: "valdres", // Usually your repo name.
    onBrokenLinks: "throw",
    onBrokenMarkdownLinks: "warn",
    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },
    presets: [
        [
            "classic",
            {
                // pages: {},
                docs: {
                    sidebarPath: "./sidebars.ts",
                    // Please change this to your repo.
                    // Remove this to remove the "edit this page" links.
                    // editUrl:
                    //     "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
                },
                blog: false,
                // blog: {
                //     showReadingTime: true,
                //     feedOptions: {
                //         type: ["rss", "atom"],
                //         xslt: true,
                //     },
                //     // Please change this to your repo.
                //     // Remove this to remove the "edit this page" links.
                //     editUrl:
                //         "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
                //     // Useful options to enforce blogging best practices
                //     onInlineTags: "warn",
                //     onInlineAuthors: "warn",
                //     onUntruncatedBlogPosts: "warn",
                // },
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],
    scripts: [
        {
            src: "https://plausible.io/js/script.js",
            defer: true,
            "data-domain": "valdres.dev",
        },
    ],
    plugins: [
        "custom-loader",
        "@docusaurus/theme-live-codeblock",
        [
            "posthog-docusaurus",
            {
                apiKey: "phc_MjR7xyzZcHEsrr09GnGgBUmZ0I40u3T3kbn5BEkd95v",
                // appUrl: "<ph_client_api_host>", // optional, defaults to "https://us.i.posthog.com"
                enableInDevelopment: false, // optional
            },
        ],
        // [
        //     "@docusaurus/plugin-client-redirects",
        //     {
        //         redirects: [
        //             {
        //                 to: "/docs/react",
        //                 from: "/",
        //             },
        //         ],
        //     },
        // ],
        // "@orama/plugin-docusaurus-v3",
    ],
    themeConfig: {
        // Replace with your project's social card
        image: "img/docusaurus-social-card.jpg",
        navbar: {
            // title: "Valdres",
            logo: {
                alt: "Valdres Logo",
                src: "img/valdres.svg",
            },
            items: [
                {
                    type: "docSidebar",
                    sidebarId: "react",
                    position: "left",
                    label: "React",
                },
                {
                    type: "docSidebar",
                    sidebarId: "vanilla",
                    position: "left",
                    label: "Vanilla",
                },
                // { to: "/blog", label: "Blog", position: "left" },
                {
                    href: "https://github.com/eigilsagafos/valdres",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        liveCodeBlock: {
            /**
             * The position of the live playground, above or under the editor
             * Possible values: "top" | "bottom"
             */
            playgroundPosition: "bottom",
        },
        footer: {
            style: "dark",
            links: [
                {
                    title: "Docs",
                    items: [
                        {
                            label: "Docs",
                            to: "/docs/quickstart",
                        },
                    ],
                },
                // {
                //     title: "Community",
                //     items: [
                //         {
                //             label: "Stack Overflow",
                //             href: "https://stackoverflow.com/questions/tagged/docusaurus",
                //         },
                //         {
                //             label: "Discord",
                //             href: "https://discordapp.com/invite/docusaurus",
                //         },
                //         {
                //             label: "Twitter",
                //             href: "https://twitter.com/docusaurus",
                //         },
                //     ],
                // },
                {
                    title: "More",
                    items: [
                        {
                            label: "GitHub",
                            href: "https://github.com/facebook/docusaurus",
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
}

export default config
