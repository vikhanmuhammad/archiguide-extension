"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = exports.STACKS = exports.THEMES = void 0;
const vscode = __importStar(require("vscode"));
const DEFAULT_STATE = {
    currentStep: 0,
    projectName: '',
    systemDescription: '',
    pages: [],
    selectedStack: '',
    designToken: { theme: 'indigo', primary: '#6366f1', radius: '8px', font: 'Inter' },
    workspacePath: '',
    initialized: false,
};
exports.THEMES = {
    indigo: { theme: 'indigo', primary: '#6366f1', radius: '8px', font: 'Inter' },
    emerald: { theme: 'emerald', primary: '#10b981', radius: '6px', font: 'Inter' },
    rose: { theme: 'rose', primary: '#f43f5e', radius: '10px', font: 'Inter' },
    slate: { theme: 'slate', primary: '#475569', radius: '4px', font: 'Inter' },
};
exports.STACKS = [
    { id: 'laravel-blade', label: 'Laravel + Blade', type: 'Monolith', cmd: 'composer create-project laravel/laravel project' },
    { id: 'laravel-vue', label: 'Laravel + Vue (Inertia)', type: 'Monolith modern', cmd: 'composer create-project laravel/laravel project' },
    { id: 'node-angular', label: 'Node.js + Angular', type: 'Separated BE/FE', cmd: 'ng new project' },
    { id: 'node-react', label: 'Node.js + React', type: 'Separated BE/FE', cmd: 'npx create-react-app project' },
    { id: 'django-react', label: 'Django + React', type: 'Separated BE/FE', cmd: 'django-admin startproject project' },
];
class StateManager {
    constructor(context) {
        this.context = context;
        this.state = { ...DEFAULT_STATE };
    }
    getState() { return this.state; }
    getThemes() { return exports.THEMES; }
    getStacks() { return exports.STACKS; }
    // Called once a workspace folder is confirmed open
    async initFromWorkspace() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders)
            return false;
        const root = folders[0].uri;
        this.state.workspacePath = root.fsPath;
        this.configUri = vscode.Uri.joinPath(root, '.archiguide', 'config.json');
        try {
            const raw = await vscode.workspace.fs.readFile(this.configUri);
            const saved = JSON.parse(raw.toString());
            this.state = saved;
            // Always sync workspacePath to current open folder
            this.state.workspacePath = root.fsPath;
        }
        catch {
            // Fresh project — stay on step 0 until folder chosen
        }
        return true;
    }
    async save() {
        if (!this.configUri)
            return;
        const dir = vscode.Uri.joinPath(this.configUri, '..');
        await vscode.workspace.fs.createDirectory(dir);
        await vscode.workspace.fs.writeFile(this.configUri, Buffer.from(JSON.stringify(this.state, null, 2)));
    }
    update(partial) {
        this.state = { ...this.state, ...partial };
        this.save();
    }
    setStep(step) { this.update({ currentStep: step }); }
    setTheme(themeId) {
        const token = exports.THEMES[themeId] ?? exports.THEMES.indigo;
        this.update({ designToken: token });
    }
    /**
     * Show a folder picker so user chooses WHERE to put the project,
     * then create a subfolder named after the project and open it as workspace.
     */
    async createAndOpenWorkspace(projectName) {
        if (!projectName.trim())
            return false;
        // Ask user to pick a PARENT directory
        const picked = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Simpan project di sini',
            title: `ArchiGuide — Pilih lokasi untuk folder "${projectName}"`,
        });
        if (!picked || picked.length === 0)
            return false;
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
                'project',
            ];
            for (const dir of dirs) {
                await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(projectUri, dir));
            }
            // Write .archiguide/config.json BEFORE opening (window reload wipes in-memory state)
            const configUri = vscode.Uri.joinPath(projectUri, '.archiguide', 'config.json');
            const bootstrap = {
                ...this.state,
                projectName: projectName.trim(),
                workspacePath: projectUri.fsPath,
                currentStep: 1,
                initialized: false,
            };
            await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(bootstrap, null, 2)));
            // Write a .gitkeep in each empty folder so git tracks them
            for (const dir of ['.github', 'docs/design', 'docs/copilot-guides', 'project']) {
                await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(projectUri, dir, '.gitkeep'), new Uint8Array(0));
            }
        }
        catch (err) {
            throw new Error(`Gagal membuat folder project di "${projectUri.fsPath}": ${err}`);
        }
        // Open the new folder as the workspace (reuse current window)
        // Window reloads here — nothing after this runs in the same session
        await vscode.commands.executeCommand('vscode.openFolder', projectUri, { forceNewWindow: false });
        return true;
    }
    async openFile(relativePath) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders)
            return;
        const uri = vscode.Uri.joinPath(folders[0].uri, relativePath);
        try {
            await vscode.commands.executeCommand('vscode.open', uri);
        }
        catch { }
    }
    workspaceReady() {
        return !!vscode.workspace.workspaceFolders?.length;
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=stateManager.js.map