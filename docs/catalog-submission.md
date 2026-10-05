# Obsidian directory submission — 0.2.1

This is a preparation document, not a confirmation that the plugin has been submitted or approved.

## Listing copy

- **Repository:** `cecam/jev-organizer`
- **ID:** `jev-organizer` (availability must be checked by the directory)
- **Name:** Jev Organizer
- **Description:** Classify the active note with TypeSafe's Jev and move it to a selected folder, with a review folder and undo.
- **Author:** Celso Cárdenas
- **License:** MIT
- **Minimum Obsidian version:** 1.11.4
- **Platforms:** Desktop only
- **Payment:** Optional payment — users supply their own TypeSafe account/API key; API charges may apply.
- **Language:** Spanish interface, English and Spanish documentation.

Suggested listing introduction:

> Give each folder a description, then classify and archive your active note with one command. Jev chooses only from your selected folders. Uncertain results go to a review folder, and you can undo the last move. Requires your own TypeSafe account and API key; the note is sent to TypeSafe and usage may incur charges. Desktop only; Spanish interface.

## Publish a GitHub release

The **Prepare draft release** workflow in GitHub Actions can run the checks and create a draft with the correct files. It only runs manually, does not publish the release, and requires write access to repository contents. Review the resulting draft before publishing.

1. Run `npm ci` and `npm run check`, then `npm run package`.
2. Commit and push the reviewed code and manifests to the default branch.
3. Create a release tagged **`0.2.1`**, matching `manifest.json` exactly. Use the changelog entry for the release notes and describe it as an early public release.
4. Attach **`main.js`, `manifest.json`, and `styles.css` individually**. The ZIP and its SHA-256 are optional additional downloads, not substitutes for those files.
5. Confirm that the release assets correspond to the tagged source. Publish as a normal release when ready for the directory installer; an early version number does not require a `-beta` suffix.

## Submit to Obsidian

1. Sign into [Obsidian Community](https://community.obsidian.md) with the owner's Obsidian account and connect GitHub.
2. Add the plugin by repository, check ID availability and review the disclosures/payment classification above.
3. Address the directory's scanner results. Local linting is not a guarantee of acceptance.
4. Publish the directory entry when ready. Errors must be resolved before in-app installation is available.
5. Use GitHub Issues for feedback. Announce in the forum only after the listing/release is available.

The owner must complete account linking and acceptance of the directory policies. Screenshots are optional; use a temporary vault containing fictional notes, never private content or API keys. No synthetic preview should be labeled as a screenshot of Obsidian.

## Local validation notes

The runtime is checked with the official recommended ESLint rules. The CLI evaluation runner is a development tool and is not bundled into `main.js`; it lives under `scripts/`. Tests and build scripts are excluded from runtime linting and still typechecked or executed by their respective checks.

Compatibility requires the legacy `display()` settings API for Obsidian 1.11.4. Adoption of the newer declarative search API is deferred; the rule warning and legacy tooltip deprecation are documented in code; local lint permits these two warnings. The shared HTTP client also runs under Node for evaluation and therefore uses portable timers.

## Official references

- [Submit a plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Directory FAQ](https://docs.obsidian.md/community-directory/faq)
