import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
export default defineConfig([
  { ignores: ['node_modules/**', 'release/**', 'main.js', 'tests/**', 'scripts/**', '*.config.*'] },
  ...obsidianmd.configs.recommended,
  { languageOptions: { parserOptions: { projectService: true } }, rules: { 'obsidianmd/ui/sentence-case': ['warn', { brands: ['Jev Organizer', 'Jev', 'TypeSafe', 'Obsidian', 'Markdown'], ignoreWords: ['jev-1.13.0', 'jev-latest'] }] } },
  // This shared client also runs in the Node evaluation CLI, where window is unavailable.
  { files: ['src/client.ts'], rules: { 'obsidianmd/prefer-window-timers': 'off' } },
]);
