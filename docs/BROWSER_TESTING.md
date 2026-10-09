# Browser testing checklist

Automated checks (unit tests, lint, build) run in CI. Chromium is also exercised end-to-end with a fake microphone during development. **Firefox, Safari and iOS need a person with a real device.** Run this checklist before a release and note the results in the pull request.

Use headphones. Serve over HTTPS (a Vercel preview) or `http://localhost` — the microphone is blocked on plain `http` elsewhere.

| Step | Chrome/Edge | Firefox | Safari macOS | Safari iOS | Chrome Android |
| --- | --- | --- | --- | --- | --- |
| Page loads with no console errors (CSP violations show there) | | | | | |
| Onboarding: consent required, voice test runs all 3 steps and gives a range | | | | | |
| "Enable microphone" asks for permission once; meter moves | | | | | |
| Export panel shows the sample rate (44.1 or 48 kHz) and it matches the device | | | | | |
| A warning appears if the browser forced echo cancellation / noise suppression / AGC | | | | | |
| Record a sustained vowel: count-in, karaoke, auto-stop, QC shows sensible values | | | | | |
| Play take sounds identical to what you sang (no gaps, no pitch change) | | | | | |
| Reference tone plays in headphones; Mute works | | | | | |
| Accept → reload the page → take is still there | | | | | |
| ZIP export opens; WAVs play in a DAW at the right speed | | | | | |
| Continuous session WAV exports | | | | | |
| Switch interface language; switch speech languages | | | | | |
| Offline: load once, go offline, reload — the app still opens | | | | | |
| Keyboard only: Tab through controls with a visible focus ring; Space/Enter/R/T/M/arrows | | | | | |
| Screen reader (VoiceOver/NVDA/TalkBack) announces buttons, phase and QC | | | | | |
| Mobile: no horizontal scroll; record button reachable; screen rotation keeps state | | | | | |

## Known platform notes

- **iOS Safari** starts audio only after a tap. If audio stops after a phone call or switching apps, tap anywhere to resume. Safari may ignore requests to turn off voice processing on some devices; a warning at the top of the page will say so.
- **Firefox** refuses to mix audio at different sample rates; the app rebuilds its audio context at the microphone's rate automatically.
- **Older browsers** without AudioWorklet fall back to ScriptProcessor. The `data-capture` attribute on `<html>` shows which one is in use (`worklet` or `script`).
- Storage can be evicted under pressure. The app asks for persistent storage; export your takes regularly anyway.
