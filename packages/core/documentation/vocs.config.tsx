import { defineConfig } from "vocs"

export default defineConfig({
    title: "Valdres",
    titleTemplate: "%s - Valdres",
    description:
        "Fast atom based state library for React and JavaScript. Inspired by but faster than Jotai and Recoil",
    baseUrl: "https://valdres.dev",
    iconUrl: {
        dark: "/icon-dark.svg",
        light: "/icon-light.svg",
    },
    logoUrl: {
        dark: "/logo-dark.svg",
        light: "/logo-light.svg",
    },
    font: {
        mono: { google: "Fira Code" },
    },
    head: () => {
        return (
            <script
                dangerouslySetInnerHTML={{
                    __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('phc_MjR7xyzZcHEsrr09GnGgBUmZ0I40u3T3kbn5BEkd95v',{api_host:'https://us.i.posthog.com', person_profiles: 'always'})`,
                }}
            />
        )
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
            link: "/docs/react/quick-start",
            match: "/docs/react",
        },
        { text: "Vanilla JS", link: "/docs/vanilla", match: "/docs/vanilla" },
    ],
    sidebar: {
        "/docs/vanilla": [
            {
                text: "Getting Started",
                link: "/docs/vanilla/getting-started",
            },
            {
                text: "API",
                collapsed: false,
                items: [
                    {
                        text: "atom",
                        link: "/docs/vanilla/api/atom/",
                    },
                    {
                        text: "selector",
                        link: "/docs/vanilla/api/selector/",
                    },
                    {
                        text: "selector",
                        link: "/docs/vanilla/api/atomFamily/",
                    },
                    {
                        text: "selector",
                        link: "/docs/vanilla/api/selectorFamily/",
                    },
                ],
            },
        ],
        "/docs/react": [
            {
                text: "valdres-react",
                items: [
                    {
                        text: "Getting Started",
                        collapsed: false,
                        items: [
                            {
                                text: "Introduction",
                                link: "/docs/react/introduction/",
                            },
                            {
                                text: "Quick Start",
                                link: "/docs/react/quick-start/",
                            },
                            {
                                text: "Performance",
                                link: "/docs/react/performance/",
                            },
                        ],
                    },
                    {
                        text: "API",
                        collapsed: false,
                        items: [
                            {
                                text: "atom",
                                link: "/docs/react/api/atom/",
                            },
                            {
                                text: "selector",
                                link: "/docs/react/api/selector/",
                            },
                            {
                                text: "Provider",
                                link: "/docs/react/api/Provider/",
                            },
                            {
                                text: "useAtom",
                                link: "/docs/react/api/useAtom/",
                            },
                            {
                                text: "useValue",
                                link: "/docs/react/api/useValue/",
                            },
                            {
                                text: "useSetAtom",
                                link: "/docs/react/api/useSetAtom/",
                            },
                            {
                                text: "useResetAtom",
                                link: "/docs/react/api/useResetAtom/",
                            },
                            {
                                text: "useStore",
                                link: "/docs/react/api/useStore/",
                            },
                        ],
                    },
                ],
            },
            {
                text: "@valdres-react",
                collapsed: true,
                items: [
                    {
                        text: "@valdres-react/color-mode",
                        collapsed: true,
                        items: [
                            {
                                text: "Getting Started",
                                link: "/docs/react/api/useValue",
                            },
                        ],
                    },
                ],
            },
        ],
    },
})
