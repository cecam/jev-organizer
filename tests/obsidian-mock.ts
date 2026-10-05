export class TFolder { constructor(public path: string) {} }
export class TFile {
  extension = 'md';
  constructor(public path: string, public content: string) {}
  get basename() { return this.path.split('/').at(-1)!.replace(/\.md$/, ''); }
}
export class MarkdownView {
  editor: { getValue: () => string };
  constructor(public file: TFile, public text: string, private onSave: () => void = () => {}) { this.editor = { getValue: () => this.text }; }
  async save() { this.file.content = this.text; this.onSave(); }
  getViewData() { return this.text; }
}
export class Notice {
  static messages: unknown[] = [];
  constructor(message: unknown, _timeout?: number) { Notice.messages.push(message); }
  hide() {}
}
export class Plugin {
  commands: any[] = [];
  savedData: unknown;
  inputData: unknown;
  constructor(public app: any, public manifest: any) {}
  async loadData() { return this.inputData; }
  async saveData(value: unknown) { this.savedData = value; }
  addCommand(command: any) { this.commands.push(command); }
  addSettingTab(_tab: unknown) {}
  registerEvent(_ref: unknown) {}
}
export class PluginSettingTab { constructor(public app: any, public plugin: any) {} }
export class AbstractInputSuggest<T> { constructor(public app: any, _input: unknown) {} }
export class SecretComponent {}
export class Setting {}
export const normalizePath = (path: string) => path.replaceAll('\\', '/').replace(/\/{2,}/g, '/');
export async function requestUrl() { throw new Error('Network is disabled in integration tests'); }
