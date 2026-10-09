# Technical guide — recording a voice dataset for Applio/RVC

[Português (Brasil)](GUIA.pt-BR.md)

This guide covers why the studio records what it records, how to get clean takes, and which conversion settings matter afterwards. Applio and RVC evolve quickly: when a parameter name here differs from your version, trust your version's tooltip.

## 1. What a good dataset looks like

- **One speaker**, the same microphone and position throughout.
- **10–15 minutes of voiced audio** (silence does not count). Less than ~8 minutes tends to sound thin; more than ~30 minutes brings diminishing returns.
- **Lossless**: the studio exports WAV PCM, 16- or 24-bit, mono, at your interface's sample rate (usually 48 kHz).
- **Variety**: vowels across the whole comfortable range, glides, real phrases, natural speech with different intentions, fast articulation, soft and loud dynamics. The model can only reproduce what it has heard — including notes, languages and styles.
- **Dry and unprocessed**: no reverb, no auto-tune, no compression, no noise suppression. The model learns every artifact.

## 2. Recording technique

- **Closed-back headphones.** The reference tone must never reach the microphone.
- Turn off the operating system's “microphone enhancements”. The studio already asks the browser for audio without echo cancellation, noise suppression or automatic gain; if a browser forces one of them anyway, a warning appears at the top of the page.
- **15–20 cm** from the microphone, pop filter, same position for every take.
- **Gain**: peaks between −12 and −6 dBFS. Never light up CLIP.
- **Room**: a dry space (wardrobe, blankets, curtains). A noise floor under −60 dBFS is ideal; measure it under *Settings → Background noise*.
- **Take length is only for comfort.** Applio's preprocessing slices every file into short chunks again, so a 5-second take and a 9-second take are equally useful. What matters is that each take is clean.
- Rest your voice every 15 takes or so. A tired or strained take teaches the model strain.

## 3. Vocal registers, passaggio and preventing model strain

- **Why mixed voice and falsetto are vital:** Neural embedding models (such as ContentVec) fail when extrapolating outside recorded timbre domains. If your dataset is 100% chest voice, then whenever an inference song hits notes in the vocal transition zone (passaggio, e.g. D4–G4 for male voices) or above, the RVC model will artificially pull chest weight up, producing strained, shrill, nasal artifacts or octave cracks.
- **Target register mix in the dataset:**
  - **Chest voice (25–35%):** core acoustic body and fundamental power.
  - **Mixed voice / Passaggio (25–35%):** the essential bridge across your vocal break. Crucial for realistic song melody conversion.
  - **Falsetto / Head voice (15–25%):** pure cord edge vibration. Prevents high soft notes from collapsing.
  - **Natural speech (10–20%):** conversational formant and diction anchors.
- **Techniques to navigate high notes without straining:**
  - *Semi-occluded vocal tract (SOVPE):* use "ng" sirens and gentle trills to balance subglottic air pressure before opening vowels.
  - *Pharyngeal twang:* practice with "Nay" or "Gee" to encourage clean cord closure without dragging heavy chest mass upward.
  - *Vowel narrowing:* round and narrow open vowels towards the top of your range (e.g. modify "Ah" toward "Uh/Oh") rather than spreading horizontally.
- **Brightness is not nasality:** pinch your nose while singing a sustained vowel. If the tone changes, lift the soft palate (think of a yawn).
- Near the top of your range, lighten up instead of pushing. The studio includes `dataset_info.json` in the exported ZIP with tailored training recommendations for Applio.

## 4. Training in Applio

1. **Dataset folder**: unzip the export into `assets/datasets/YourVoiceName`. Use ASCII only — no spaces or accents in any folder or file name.
2. **Preprocess**: choose the sample rate of the **pretrained model** you will use (32k, 40k or 48k); Applio resamples your WAVs. Keep automatic slicing on.
3. **Extract**: pitch extractor `rmvpe`, embedder `contentvec` (or the embedder your pretrained model expects). **The embedder used at inference must be the same one used here.**
4. **Train**: start from a pretrained model (Applio picks one matching the sample rate; community pretrained models also exist, some tuned for specific languages). Save a checkpoint every 10–50 epochs. When it finishes, the index is built (or run *Train Index*).
5. **Choose the epoch by ear.** Convert the same short test phrase with several checkpoints and pick the one that sounds most like you with the fewest artifacts. Loss curves and fixed epoch counts are only hints; the overtraining detector can help you stop early.

## 5. Converting (inference) — the settings that matter

| Setting | What it really does |
| --- | --- |
| **Pitch** (semitones) | Transposes the input before conversion. Bring the reference melody into *your* range rather than forcing a darker timbre. |
| **Pitch extractor** (f0 method) | **This is where the melody comes from.** `rmvpe` is the robust default for speech and most singing. |
| **Index rate** | How strongly the retrieval index pulls timbre and pronunciation towards the training data. **It does not control the melody.** Lower it for languages or styles that are scarce in your dataset, raise it when the model sounds too little like you. |
| **Protect** | Protects voiceless consonants and breaths from being converted. **Lower values protect more; 0.5 turns protection off.** Very low values can also weaken the index. For breathy voices, try 0.20–0.30. |
| **Formant shifting** | Quefrency and Timbre start at **1.0** (neutral). Move them only a little (e.g. Timbre 0.9–1.0) and check by ear. Large changes are for cross-gender conversions. |
| **Autotune** | Gentle pitch correction for singing; leave off for speech. |

Clean the input first: convert an isolated, dry vocal (separate it from the instrumental and remove reverb) and mix it back afterwards.

## 6. Troubleshooting

| Symptom | Likely cause | What to try |
| --- | --- | --- |
| Thin or nasal on high notes | Few seconds of singing in that part of the range | Record more exercises there (range map), or transpose the input down |
| Robotic or metallic breaths | Protect too high/off, noisy input | Lower Protect, clean the input |
| Wrong accent or mushy words in another language | Little of that language in the dataset | Add that language pack or your lyrics; lower Index rate |
| Mushy consonants in fast songs | Dataset recorded too slowly | Record the fast articulation exercises |
| Garbled output | Embedder mismatch between training and inference | Use the same embedder |
| Out-of-tune result | Poor pitch extraction, reverb in the input | Use `rmvpe`, remove reverb before converting |
