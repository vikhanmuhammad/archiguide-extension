import * as vscode from 'vscode';

export type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DesignToken {
  theme: string;
  primary: string;
  radius: string;
  font: string;
}

export interface ProjectState {
  currentStep: Step;
  projectName: string;
  systemDescription: string;
  styleDescription: string;
  referenceFiles: string[];
  pages: string[];
  selectedStack: string;
  designToken: DesignToken;
  workspacePath: string;
  initialized: boolean;
}

const DEFAULT_STATE: ProjectState = {
  currentStep: 0,
  projectName: '',
  systemDescription: '',
  styleDescription: '',
  referenceFiles: [],
  pages: [],
  selectedStack: '',
  designToken: { theme: 'custom', primary: '#6366f1', radius: '8px', font: 'Inter' },
  workspacePath: '',
  initialized: false,
};

export const STACKS = [
  { id: 'laravel-blade', label: 'Laravel + Blade',       type: 'Monolith',        cmd: 'composer create-project laravel/laravel project' },
  { id: 'laravel-vue',   label: 'Laravel + Vue (Inertia)',type: 'Monolith modern', cmd: 'composer create-project laravel/laravel project' },
  { id: 'node-angular',  label: 'Node.js + Angular',     type: 'Separated BE/FE', cmd: 'ng new project' },
  { id: 'node-react',    label: 'Node.js + React',       type: 'Separated BE/FE', cmd: 'npx create-react-app project' },
  { id: 'django-react',  label: 'Django + React',        type: 'Separated BE/FE', cmd: 'django-admin startproject project' },
];

export class StateManager {
  private state: ProjectState;
  private configUri: vscode.Uri | undefined;

  constructor(private context: vscode.ExtensionContext) {
    this.state = { ...DEFAULT_STATE };
  }

  getState(): ProjectState { return this.state; }
  getStacks() { return STACKS; }

  // Called once a workspace folder is confirmed open
  async initFromWorkspace() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return false;
    const root = folders[0].uri;
    this.state.workspacePath = root.fsPath;
    this.configUri = vscode.Uri.joinPath(root, '.archiguide', 'config.json');
    try {
      const raw = await vscode.workspace.fs.readFile(this.configUri);
      const saved = JSON.parse(raw.toString()) as ProjectState;
      this.state = saved;
      // Always sync workspacePath to current open folder
      this.state.workspacePath = root.fsPath;
    } catch {
      // Fresh project — stay on step 0 until folder chosen
    }
    return true;
  }

  async save() {
    if (!this.configUri) return;
    const dir = vscode.Uri.joinPath(this.configUri, '..');
    await vscode.workspace.fs.createDirectory(dir);
    await vscode.workspace.fs.writeFile(
      this.configUri,
      Buffer.from(JSON.stringify(this.state, null, 2))
    );
  }

  update(partial: Partial<ProjectState>) {
    this.state = { ...this.state, ...partial };
    this.save();
  }

  setStep(step: Step) { this.update({ currentStep: step }); }

  /**
   * Show a folder picker so user chooses WHERE to put the project,
   * then create a subfolder named after the project and open it as workspace.
   */
  async createAndOpenWorkspace(projectName: string): Promise<boolean> {
    if (!projectName.trim()) return false;

    // Ask user to pick a PARENT directory
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Simpan project di sini',
      title: `ArchiGuide — Pilih lokasi untuk folder "${projectName}"`,
    });
    if (!picked || picked.length === 0) return false;

    // Build the new project folder URI
    const safeName = projectName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const projectUri = vscode.Uri.joinPath(picked[0], safeName);

    try {
      // Create root project folder
      await vscode.workspace.fs.createDirectory(projectUri);

      // Create standard ArchiGuide folder structure
      const dirs = [
        '.archiguide',
        '.github',
        'docs',
        'docs/design',
        'docs/copilot-guides',
        'docs/references',
        'project',
      ];
      for (const dir of dirs) {
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(projectUri, dir));
      }

      // Write .archiguide/config.json BEFORE opening (window reload wipes in-memory state)
      const configUri = vscode.Uri.joinPath(projectUri, '.archiguide', 'config.json');
      const bootstrap: ProjectState = {
        ...this.state,
        projectName: projectName.trim(),
        workspacePath: projectUri.fsPath,
        currentStep: 1,
        initialized: false,
      };
      await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(bootstrap, null, 2)));

      // Write a .gitkeep in each empty folder so git tracks them
      for (const dir of ['.github', 'docs/design', 'docs/copilot-guides', 'docs/references', 'project']) {
        await vscode.workspace.fs.writeFile(
          vscode.Uri.joinPath(projectUri, dir, '.gitkeep'),
          new Uint8Array(0),
        );
      }
    } catch (err) {
      throw new Error(`Gagal membuat folder project di "${projectUri.fsPath}": ${err}`);
    }

    // Open the new folder as the workspace (reuse current window)
    // Window reloads here — nothing after this runs in the same session
    await vscode.commands.executeCommand('vscode.openFolder', projectUri, { forceNewWindow: false });
    return true;
  }

  async openFile(relativePath: string) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    const uri = vscode.Uri.joinPath(folders[0].uri, relativePath);
    try { await vscode.commands.executeCommand('vscode.open', uri); } catch {}
  }

  workspaceReady(): boolean {
    return !!vscode.workspace.workspaceFolders?.length;
  }
}
