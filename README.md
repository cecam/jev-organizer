# Jev Organizer

Classify the active Markdown note with TypeSafe's Jev and move it to one of your selected folders in Obsidian.

[Guía en español](README.es.md) · [Report a bug](https://github.com/cecam/jev-organizer/issues/new?template=bug_report.yml) · [Suggest an improvement](https://github.com/cecam/jev-organizer/issues/new?template=feature_request.yml)

**Early release. Desktop only. The interface is currently in Spanish.** This project is independent of Obsidian and TypeSafe. It is being prepared for the community directory; it is not yet listed.

## What it does

- Pick folders using checkboxes, including select all, then describe what belongs in each folder.
- Run **Clasificar y archivar nota** (classify and archive note) from the command palette or your own hotkey.
- Jev chooses from that closed list. The plugin moves the note and preserves its filename.
- Ambiguous results go to **Por revisar** (needs review), created on first activation. You can change this folder.
- Undo the last move during the current session. Existing filenames are never deliberately overwritten.
- Deselecting a folder preserves its description for future use.

There is no background classification, bulk processing, automatic tagging, or rewriting of the note. Obsidian may update links as part of a move, according to your link settings.

## Requirements and costs

- **Obsidian 1.11.4 or newer on desktop.** Mobile is not supported in this release.
- **Your own TypeSafe account and API key with access to Jev.** The plugin does not provide an API key or credits.
- Internet access when checking the connection or classifying a note.

The plugin is free to use under MIT, but **TypeSafe API usage may incur charges**. Check your account and [TypeSafe's current model information](https://docs.typesafe.ai/models). For the Obsidian directory, this dependency is disclosed as **Optional payment**.

## Privacy and network disclosure

When you run classification, the plugin sends the active note's **title and complete Markdown, including existing frontmatter**, plus the enabled category names, descriptions, and examples to `https://api.typesafe.ai/v1/systemone`. It does not expand linked notes or attachments, or send category folder paths. A note's own text may contain personal information or paths.

**Probar conexión** calls `https://api.typesafe.ai/v1/models` to check access without sending notes. Requests carry your TypeSafe API key. Data processing at TypeSafe is governed by [TypeSafe's legal and privacy documents](https://docs.typesafe.ai/legal); this plugin does not promise zero retention by the provider.

The plugin has **no analytics, telemetry, advertising, or custom backend**. It does not log note contents, API keys, or API response bodies. It does not access files outside the vault for classification and does not install or update itself. Settings are saved in the vault's plugin configuration; API keys are managed by Obsidian's secret storage, with only the selected secret ID saved in the plugin's settings. No additional encryption is implemented by the plugin.

Disabling the plugin prevents pending results from moving notes. It cannot recall a request already sent to TypeSafe.

## Install manually

Until the plugin is available in the directory:

1. Download `main.js`, `manifest.json`, and `styles.css` from a [published release](https://github.com/cecam/jev-organizer/releases). If no release is published yet, build from source using the commands below.
2. Place those three files inside `<vault>/.obsidian/plugins/jev-organizer/`. If you use a custom configuration directory, substitute it for `.obsidian`.
3. Enable community plugins, reload Obsidian, and enable **Jev Organizer**.

Alternatively, extract the release ZIP and copy its `jev-organizer` folder into the plugins directory. To update, disable the plugin and replace only the three runtime files. **Keep your existing `data.json`** to preserve configuration.

## Configure and use

1. Open **Settings → Jev Organizer**.
2. Under **Clave de TypeSafe**, create or select a secret. Its ID can be `jev-organizer-api-key`: lowercase letters, digits and hyphens only. Paste the API key into the **Secret** field, not the ID.
3. Click **Probar conexión**. This tests API access, not a complete classification or access to every model version.
4. Select folders and click **Aplicar selección**. Subfolders are independent choices; the review folder is excluded. At most 254 folders may participate.
5. Fill in the required description for each selected folder. Describe inclusions, exclusions, and optional examples. Changes to descriptions save as you type.
6. Open a note and run **Jev Organizer: Clasificar y archivar nota**. The note is saved before the request.
7. Use **Deshacer** in the result notice or **Jev Organizer: Deshacer último movimiento** to undo the last move.

The initial confidence threshold is **0.80**. Lower-confidence results and “none of these categories” go to the review folder. This is not an 80% accuracy guarantee. The default model is pinned to `jev-1.13.0`; an advanced setting accepts other Jev IDs, including `jev-latest`.

## Limits and recovery

- Classification can be wrong. Start with copied notes and descriptions that distinguish overlapping categories.
- A changed note or changed settings during a request cancel the move. Run the command again.
- Network/authentication errors, malformed responses, missing category folders and filename collisions leave the note in its current location. They do not send it to review.
- Requests have a 30-second deadline and at most one retry for transient HTTP errors. Oversized notes are not silently truncated.
- Undo survives only for the current plugin session, preserves later edits, and stops if the file moved externally, the original folder disappeared or the original filename is occupied.
- Internal links follow your Obsidian settings. Enable automatic link updates if you want Obsidian to maintain links on moves.
- The maintainer has used earlier versions in Obsidian. Automated tests cover logic and a simulated vault; this is not a claim of certification or measured accuracy on other users' notes. See [validation notes](TESTING.md).

## Feedback

Please use [GitHub Issues](https://github.com/cecam/jev-organizer/issues). Include plugin/Obsidian versions, operating system, reproducible steps, and expected versus actual behavior. **Never post API keys, your secrets store, or private notes.** Use fictional examples when reporting classification problems. See [contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md).

## Development

Node.js 22 or later and npm are recommended for the development scripts.

```sh
npm ci
npm run check
npm run package
```

`check` runs the official Obsidian ESLint rules, TypeScript/build, tests, and release metadata validation. `package` creates the installable ZIP and SHA-256 under `release/`; the three runtime files are also available in the project root. Packaging uses `/usr/bin/zip` on macOS/Linux. `npm run dev` watches source changes.

The optional evaluation runner requires `TYPESAFE_API_KEY` in your environment. `npm run evaluate` sends 24 **synthetic** Spanish examples to TypeSafe and generates a local report. It is not a benchmark of real-world accuracy. See [the Spanish guide](README.es.md#evaluación-de-clasificación) for custom datasets. CI uses mocks and never needs a real API key.

## License

[MIT](LICENSE) — Copyright (c) 2026 Celso Cárdenas.
