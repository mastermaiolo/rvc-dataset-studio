# Contributing

Thanks for helping! Contributions of all sizes are welcome: bug reports, translations, language packs, exercises and code. Portuguese and English are both fine in issues and pull requests.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ground rules

- **Privacy first.** The app must keep working with no server: no uploads, no accounts, no third-party requests at runtime, no cookies. New dependencies must be bundled, never loaded from a CDN.
- **Ethics.** Features must not make it easier to clone someone else's voice without consent.
- **Content licence.** Everything in `content/` and `schema/` is CC0. Only contribute text you wrote or that is in the public domain — **never song lyrics or copyrighted text.**

## Setting up

```sh
git clone https://github.com/<you>/rvc-dataset-studio.git
cd rvc-dataset-studio
npm install
npm run dev
```

Before opening a pull request:

```sh
npm run check   # lint, type-check, content validation, tests and build
```

The microphone only works on `https` or `localhost`. Use headphones when testing the reference tone.

## What to work on

### Language packs

The most valuable contribution: see **[docs/LANGUAGE_PACKS.md](docs/LANGUAGE_PACKS.md)**. A pack is one JSON file in its own folder; no code changes are needed. Native speakers reviewing existing packs (reading them aloud, fixing unnatural wording) are just as welcome.

### Interface translations

1. Copy `src/i18n/en.ts` to `src/i18n/<locale>.ts`, rename the export and type it as `Messages` (see `pt-BR.ts`).
2. Copy `src/i18n/tips.en.json` to `tips.<locale>.json`.
3. Register the locale in `LOCALES` in `src/i18n/index.ts`.
4. Add your locale's text to the `reg`/`emo`/`sub`/`title` fields of the content (the validator lists what is missing).

TypeScript refuses a locale with missing or extra keys. Keep `{placeholders}`, `**bold**` and `` `code` `` markers intact.

### Code

- Analysis code (`src/analysis`) is pure TypeScript with no DOM access, and every change needs a test with **synthetic signals** (see `tests/signals.ts`).
- The audio hot paths (meters, tuner, karaoke) write to the DOM directly from `requestAnimationFrame`; keep them out of the component tree.
- Keep the CSP strict: no inline scripts, no inline `style` attributes in HTML strings (setting `element.style` from code is fine).
- Accessibility: every control must work with the keyboard, have a visible focus ring and a text label.

## Pull requests

- One topic per PR, with a short description of what changed and why.
- Screenshots for UI changes (desktop and mobile).
- Say which browsers you tested in (see [docs/BROWSER_TESTING.md](docs/BROWSER_TESTING.md)).
- CI must be green.

## Reporting bugs

Use the issue templates. For audio problems, include the browser and version, operating system, microphone or audio interface, and the sample rate shown in the Export panel. **Never attach recordings of other people.**
