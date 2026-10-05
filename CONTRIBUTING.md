# Contributing

Bug reports and feature requests are welcome through [GitHub Issues](https://github.com/cecam/jev-organizer/issues). English and Spanish are both welcome.

For classification problems, include a fictional or anonymized note, the relevant category descriptions, model ID, threshold, and expected destination. Do not share private notes, API keys, secrets, or your full vault.

For code changes:

1. Install dependencies with `npm ci` (Node.js 22 or later).
2. Make a focused change and cover changes to file movement, data preservation or API behavior with regression tests.
3. Run `npm run check`.
4. Test interface changes in a temporary Obsidian vault. Do not add a vault or credentials to Git.
5. Open a pull request describing behavior, validation, and limitations.

Keep the plugin's network and privacy disclosures accurate. Do not introduce telemetry, silent note processing, destructive overwrites, or dependencies on private Obsidian APIs.

Contributions are made under the repository's MIT license.
