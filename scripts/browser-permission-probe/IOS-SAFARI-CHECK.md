# Manual iOS Safari check — motion and orientation permission

Required before publishing `@valdres/browser-device-motion` and
`@valdres/browser-device-orientation`. iOS Safari is where
`requestPermission()` gates sensor access behind a prompt that needs a user
gesture; automated Chromium runs cannot stand in for it. Record the device,
iOS version and the copied results ("Copy results") in the release PR.

## How iOS behaves (so the steps make sense)

- iOS has **one** "Motion & Orientation Access" permission per site. Allowing it
  from either request grants both, so the other request then resolves without a
  second prompt.
- A request **without** a user gesture is only refused (`NotAllowedError`, which
  the package resolves as the unchanged `"prompt"`) while the permission is
  still unanswered. Once answered, every call simply returns the answer.
- So each scenario below starts from an **unanswered origin**. Easiest: a new
  quick tunnel (each `cloudflared tunnel --url http://localhost:3033` run gets a
  new hostname, so a new origin). Otherwise: Settings → Apps → Safari →
  Advanced → Website Data → delete the site, then reload. The banner at the top
  of the page says whether the page currently sees an unanswered permission.

## Setup

1. `bun run scripts/browser-permission-probe/ios-safari.ts` (port 3033). It
   bundles the packages once at startup: restart it after pulling or changing
   them, and check that `environment.build.commit` in the copied results is
   the commit under test.
2. Open it on the device over **HTTPS**: an HTTPS tunnel to port 3033, or run
   with `TLS_CERT`/`TLS_KEY` for a certificate the device trusts.

## Scenario 1 — grant (fresh origin)

| # | Action | Expected | Result |
|---|--------|----------|--------|
| 1.0 | Load the page | `isSecureContext: true`, both `requestPermission: "function"`; statuses `"active"`; permissions `"prompt"`; banner says unanswered; no prompt; `events: 0` | |
| 1.1 | Tap **C** and wait until the log shows `no-gesture requestMotionPermission resolved` (the buttons re-enable) | log: native call with `activation: false` (or `n/a`), then rejected `NotAllowedError`; resolves `"prompt"`; **no** system prompt; permissions still `"prompt"` | |
| 1.2 | Tap **A**, then **Allow** | native call with `activation: true` (or `n/a`); the system prompt appears; resolves `"granted"`; motion permission `"granted"`; motion `events` increase while moving the device | |
| 1.3 | Tap **B** | resolves `"granted"`, normally **without** a second prompt (shared permission — record whether one appeared); orientation `events` increase while tilting | |
| 1.4 | Tap **C** and wait until it resolves | resolves `"granted"` without a prompt (already answered) | |
| 1.5 | Reload, then tap **A** | record whether iOS prompts again; the result must be the browser's answer | |

## Scenario 2 — deny (fresh origin)

| # | Action | Expected | Result |
|---|--------|----------|--------|
| 2.1 | Tap **A**, choose **Don't Allow** | resolves `"denied"`; motion permission `"denied"`; `events` stay 0 | |
| 2.2 | Tap **B** | resolves the browser's answer (expected `"denied"`; record whether it prompts) | |
| 2.3 | Tap **A** again | resolves the browser's answer (record whether it prompts); no rejection, no page error | |

## Optional — insecure

Open over plain `http://<LAN IP>:3033`: statuses `"insecure"`, permissions
`"unsupported"`, no native call, no prompt.

## Pass criteria

1.0–1.4 and 2.1 must pass. 1.5, 2.2 and 2.3 record how iOS remembers answers,
which the package does not promise. Any rejection, page error, a prompt without
a tap, `activation: false` on a tapped call, or a granted result from 1.1 on a
fresh origin is a failure: stop the release.
