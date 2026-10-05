## Jev Organizer 0.2.1

An early public release for feedback. Classify your active Markdown note with Jev and move it to one of your selected folders.

- Select multiple folders and describe the content that belongs in each.
- Route uncertain results to a review folder.
- Undo the last move during the current session.
- Includes catalog preparation: MIT license, English/Spanish documentation, feedback templates, official lint checks and release validation.

### Requirements and disclosure

Obsidian **1.11.4+ on desktop**. The interface is in Spanish. You need your own **TypeSafe account and API key**; API usage may incur charges. Classification sends the active note's title and complete Markdown plus enabled category descriptions/examples to TypeSafe. There is no plugin telemetry. Read the README for full data disclosures and limitations.

### Installation

Download `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder for `jev-organizer`, or use the ZIP. To update, disable the plugin, replace those three files, keep `data.json`, and re-enable it.

### Validation and feedback

TypeScript/build, 40 automated tests and local release checks pass. Official runtime lint has no errors; two compatibility warnings are documented. These are local checks, not certification by Obsidian or measured classification accuracy. Earlier versions have been used by the maintainer; test new releases with copied notes.

Please report issues or suggestions at https://github.com/cecam/jev-organizer/issues using fictional examples and without API keys or private notes.
