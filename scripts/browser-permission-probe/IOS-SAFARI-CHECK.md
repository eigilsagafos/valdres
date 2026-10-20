# Manual iOS Safari check — motion and orientation permission

Required before publishing `@valdres/browser-device-motion` and
`@valdres/browser-device-orientation`. iOS Safari is where
`requestPermission()` gates sensor access behind a prompt that needs a user
gesture; automated Chromium runs cannot stand in for it. Record the device,
iOS version and the copied results in the release PR.

## Setup

1. `bun run scripts/browser-permission-probe/ios-safari.ts` (port 3033).
2. Open it on the device over **HTTPS**: an HTTPS tunnel to port 3033 (for
   example `cloudflared tunnel --url http://localhost:3033`), or run with
   `TLS_CERT`/`TLS_KEY` for a certificate the device trusts.
3. Start clean: Settings → Safari → Advanced → Website Data → remove the
   site (or Clear History and Website Data), then load the page.

## Checklist

| # | Action | Expected | Result |
|---|--------|----------|--------|
| 0 | Load the page | `isSecureContext: true`, both `requestPermission: "function"`; statuses `"active"`; permissions `"prompt"`; no prompt shown; `events: 0` | |
| 1 | Tap **3** and wait 6 s | the log shows the native call with `activation: false` (or `n/a` where iOS lacks `navigator.userActivation`); resolves `"prompt"`; no system prompt; permission still `"prompt"` | |
| 2 | Tap **1**, then **Allow** | native call logged with `activation: true` (or `n/a`, see 1); the system prompt appears; resolves `"granted"`; motion permission `"granted"`; `events` increase while the device moves | |
| 3 | Tap **2** | native call with `activation: true`; resolves `"granted"` (with or without a second prompt — record which); orientation events increase while tilting | |
| 4 | Reload, tap **1** | record whether iOS prompts again; the result must be the browser's answer | |
| 5 | Clear website data, reload, tap **1**, choose **Don't Allow** | resolves `"denied"`; motion permission `"denied"`; `events` stay 0 | |
| 6 | Tap **1** again | resolves the browser's answer (record whether it prompts); no rejection, no page error | |
| 7 | Optional: open over plain `http://<LAN IP>:3033` | statuses `"insecure"`, permissions `"unsupported"`, no native call, no prompt | |

Steps 0–3 and 5 must pass. Steps 4 and 6 record browser behaviour (how iOS
remembers answers), which the package does not promise. Any rejection, page
error, `activation: false` on a tapped call, or a prompt that appears
without a tap is a failure: stop the release.
