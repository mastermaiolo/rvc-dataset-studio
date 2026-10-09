# Creating a language pack

A language pack adds natural speech, articulation drills, fast readings and sung phrases in one spoken language.
Adding a language is adding one folder: every `content/langs/<id>/pack.json` is picked up automatically, validated in CI, and offered under **Settings → Speech languages**.

All content in `content/` is released under **CC0 1.0**. By contributing a pack you agree to that. Only submit text you wrote yourself or that is in the public domain (e.g. traditional tongue twisters) — **never song lyrics or text copied from books, films or websites.**

## 1. Create the folder

```
content/langs/<id>/pack.json
```

`<id>` is a BCP-47 tag: a language (`fr`, `de`, `ja`) or a language plus region when the spoken variety matters (`pt-BR`, `es-MX`). The folder name must equal the `id` inside the file.

## 2. The file

```jsonc
{
  "$schema": "../../../schema/langpack.schema.json",
  "id": "fr",
  "version": 2,
  "name": { "en": "French", "pt-BR": "Francês" },
  "script": "latin",
  "voiceTest": { "speech": "Chaque été, mon grand-père écoutait de vieux disques sur la terrasse." },
  "tips": {
    "nasalfr": { "en": "…", "pt-BR": "…" }
  },
  "exercises": [ … ]
}
```

| Field | What it is |
| --- | --- |
| `name` | Language name, shown in the language picker. |
| `script` | `latin`, `hanzi`, `cyrillic`, `arabic`, `devanagari`, `kana`, `hangul`, `greek`, `hebrew` or `other`. |
| `romanization` | Optional, e.g. `pinyin`. |
| `voiceTest.speech` | One natural sentence (~9 s) read during the voice test to measure the speaking pitch. |
| `tips` | Optional coaching tips specific to this language, keyed by name (lowercase letters). |
| `exercises` | The exercises (see below). |

### Localized text

Every text shown in the interface (`reg`, `emo`, `sub`, `title`, tips, `name`) is an object keyed by interface locale:

```json
{ "en": "Question ↗", "pt-BR": "Pergunta ↗" }
```

`en` is required; other interface locales are recommended (the validator warns when one is missing and the app falls back to English). The **exercise text itself** (`text`, `notes`, `syl`) is written in the pack's language and is not translated.

## 3. Exercises

Common fields:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | ✓ | Lowercase, digits and dashes. Unique across the whole project — prefix it with the pack id (`fr-sp-…`). Never change an id after release: takes are stored by id. |
| `cat` | ✓ | `speech`, `phonemes`, `glides` or `dynamics` (see below). |
| `mode` | ✓ | `speech`, `drill`, `melody` or `tones`. |
| `dur` | ✓ | Take length in seconds (2–20). Just a guide: Applio re-slices the audio anyway. |
| `tip` | ✓ | Name of a built-in tip (`src/i18n/tips.en.json`) or of one in this pack's `tips`. |
| `reg`, `emo`, `sub` | | Register, mood and a one-line hint (localized). |
| `title` | | Title in the exercise list; generated automatically when absent. |

### Speech — `cat: "speech"`, `mode: "speech"`

```json
{
  "id": "fr-sp-le-train-du-matin",
  "cat": "speech", "mode": "speech",
  "text": "Le train du matin part à sept heures, alors il vaut mieux arriver un peu en avance.",
  "dur": 8,
  "reg": { "en": "Speech · Middle", "pt-BR": "Fala · Médio" },
  "emo": { "en": "Statement", "pt-BR": "Afirmativa" },
  "tip": "speech",
  "sub": { "en": "Falling, assured intonation at the end", "pt-BR": "Entoação descendente e segura no fim" }
}
```

Mark stressed words with asterisks: `I said *he* took it`. Aim for about **20 sentences** covering statements, yes/no and open questions, emphasis, dialogue, calm, joy, melancholy, surprise and one or two phonetically rich sentences. Keep them natural, 6–9 seconds when read calmly.

### Articulation drills — `cat: "phonemes"`, `mode: "drill"`

Items separated by ` · ` (space, middle dot, space). Use minimal pairs and sounds that are hard or characteristic in your language:

```json
{ "id": "fr-d-u-ou", "cat": "phonemes", "mode": "drill", "text": "tu · tout · vu · vous · rue · roue", "dur": 7, "tip": "rounded" }
```

### Fast readings — `cat: "dynamics"`, `mode: "speech"`, `tip: "fast"`

Three or four short sentences (4–6 s) dense in plosives and sibilants. These teach the model crisp consonants for fast songs.

### Sung phrases — `cat: "glides"`, `mode: "melody"`

Pitches are **relative to the singer's comfortable range**, so one phrase works for a bass and a soprano alike:

```json
{
  "id": "fr-p-chante-avec-moi",
  "cat": "glides", "mode": "melody",
  "pos": 0.25,
  "notes": [["Chan-", 0], ["te a-", 2], ["vec", 4], ["moi", 7, 2], ["jus-", 5], ["qu'au", 4], ["jour", 0, 3]],
  "dur": 8,
  "tip": "phrase"
}
```

- `pos` places the **first note** in the range: `0` = lowest comfortable note, `1` = highest. Values between `-0.3` and `1.3` are allowed for light touches outside.
- Each note is `[syllable, semitones from the first note, optional length weight]`. Weights default to 1; give the last syllable 2–3.
- End a syllable with `-` when the word continues (`"Chan-"`, `"te"`), so the teleprompter joins it.
- If a phrase would go more than 2 semitones above the singer's top, the app moves the **whole** phrase down (intervals never change).

Write 5–6 original phrases, mostly stepwise, within an octave.

### Tone languages — `mode: "tones"`

For languages with lexical tone, each syllable carries its tone and the reference generator plays the contour from the singer's speaking pitch:

```json
{ "id": "zh-ma", "cat": "phonemes", "mode": "tones", "syl": [["mā", "妈", 1], ["má", "麻", 2], "·", ["mǎ", "马", 3]], "dur": 6, "tip": "tones" }
```

Items are `[romanization, native script, tone]` or a separator string. Tones are `1`–`4`, `0` (neutral) and `"h"` (half third tone). Contours live in `src/bank/compile.ts` (`TONE_CONTOURS`); a new tone system needs a small code change — open an issue first.

## 4. Check it

```sh
npm run validate:content   # schema, unique ids, tips, English text
npm test                   # includes: every pack fits every voice type's range
npm run dev                # Settings → Speech languages → turn your pack on and record a few takes
```

## Checklist for a pull request

- [ ] Folder name equals `id`; ids are prefixed with the pack id.
- [ ] ~20 speech sentences, 4–6 drills, 3–4 fast readings, 5–6 sung phrases, a voice-test sentence.
- [ ] All text is original or public domain; no lyrics.
- [ ] `en` (and ideally `pt-BR`) for every localized field.
- [ ] Read everything aloud once: natural wording, comfortable length.
- [ ] `npm run validate:content` and `npm test` pass.
