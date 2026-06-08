import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { PromptBuilder } from './promptBuilder';
import { FileGenerator, parseFilesFromResponse } from './fileGenerator';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    _context: vscode.ExtensionContext,
    private readonly state: StateManager
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {

        case 'ready':
          await this.state.initFromWorkspace();
          this.postState();
          break;

        // ── Step 0: create + open workspace folder ───────────────────────
        case 'createWorkspace': {
          try {
            const ok = await this.state.createAndOpenWorkspace(msg.projectName);
            if (!ok) this.postToast('Pembuatan folder dibatalkan.', 'warn');
            // VSCode will reload the window after openFolder — nothing else needed
          } catch (err: any) {
            this.postToast('Gagal membuat project: ' + (err?.message ?? String(err)), 'error');
          }
          break;
        }

        // ── Step 1: save input → preview prompt (mode: generate) ────────
        case 'submitStep1': {
          const { projectName, systemDescription } = msg;
          if (!projectName.trim() || !systemDescription.trim()) {
            this.postToast('Isi nama proyek dan deskripsi sistem terlebih dahulu.', 'warn');
            break;
          }
          this.state.update({ projectName, systemDescription, initialized: true });
          const prompt1 = PromptBuilder.step1Prompt(this.state.getState());
          this.postToWebview({ type: 'showPrompt', prompt: prompt1, nextStep: 2, mode: 'generate' });
          break;
        }

        // ── Step 1: reference file management ────────────────────────────
        case 'addReferenceFile': {
          const folderRef = vscode.workspace.workspaceFolders;
          if (!folderRef) { this.postToast('Tidak ada workspace yang terbuka.', 'error'); break; }
          const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            openLabel: 'Pilih dokumen referensi',
            filters: { 'Dokumen': ['pdf', 'md', 'txt', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'xlsx', 'csv'] },
          });
          if (!picked?.length) break;
          const srcUri = picked[0];
          const fileName = srcUri.path.split('/').pop() ?? 'reference';
          const destPath = `docs/references/${fileName}`;
          const destUri = vscode.Uri.joinPath(folderRef[0].uri, destPath);
          try {
            await vscode.workspace.fs.copy(srcUri, destUri, { overwrite: true });
            const refs = this.state.getState().referenceFiles ?? [];
            if (!refs.includes(destPath)) {
              this.state.update({ referenceFiles: [...refs, destPath] });
            }
            this.postState();
            this.postToast(`"${fileName}" ditambahkan sebagai referensi.`, 'info');
          } catch (err: any) {
            this.postToast('Gagal menyalin file: ' + (err?.message ?? String(err)), 'error');
          }
          break;
        }

        case 'removeReferenceFile': {
          const refs = (this.state.getState().referenceFiles ?? []).filter(f => f !== msg.path);
          this.state.update({ referenceFiles: refs });
          this.postState();
          break;
        }

        // ── Step 2: style description → design tokens via Copilot Agent ──
        case 'submitStep2': {
          const { styleDescription } = msg;
          if (!styleDescription?.trim()) {
            this.postToast('Masukkan deskripsi style terlebih dahulu.', 'warn');
            break;
          }
          this.state.update({ styleDescription });
          const prompt2 = PromptBuilder.step2Prompt(this.state.getState());
          this.postToWebview({ type: 'showPrompt', prompt: prompt2, nextStep: 3, mode: 'generate' });
          break;
        }

        // ── Step 3: manage pages ──────────────────────────────────────────
        case 'addPage': {
          const name = (msg.pageName as string).trim();
          if (!name) break;
          if (this.state.getState().pages.includes(name)) {
            this.postToast(`Halaman "${name}" sudah ada.`, 'warn');
            break;
          }
          this.state.update({ pages: [...this.state.getState().pages, name] });
          this.postState();
          break;
        }

        case 'removePage': {
          const pages = this.state.getState().pages.filter(p => p !== msg.pageName);
          this.state.update({ pages });
          this.postState();
          break;
        }

        case 'generatePage': {
          const prompt3p = PromptBuilder.step3PagePrompt(msg.pageName, this.state.getState());
          this.postToWebview({ type: 'showPrompt', prompt: prompt3p, nextStep: null, mode: 'generate' });
          break;
        }

        case 'generateAllPages': {
          const pages = this.state.getState().pages;
          if (pages.length === 0) {
            this.postToast('Tambahkan minimal satu halaman terlebih dahulu.', 'warn');
            break;
          }
          // Combine all page prompts into one LM call with all [[FILE:...]] blocks
          const batchPrompt = pages
            .map(p => PromptBuilder.step3PagePrompt(p, this.state.getState()))
            .join('\n\n');
          this.postToWebview({ type: 'showPrompt', prompt: batchPrompt, nextStep: 4, mode: 'generate' });
          break;
        }

        case 'previewPage': {
          await this.previewPage(msg.pageName);
          break;
        }

        // ── Step 3: auto-detect pages from docs ──────────────────────────
        case 'detectPages': {
          const folders3 = vscode.workspace.workspaceFolders;
          if (!folders3) {
            this.postToast('Tidak ada workspace yang terbuka.', 'warn');
            break;
          }
          let detected: string[] = [];
          let readFrom = '';
          for (const docPath of ['docs/flow.md', 'docs/FSD.md']) {
            try {
              const raw = await vscode.workspace.fs.readFile(
                vscode.Uri.joinPath(folders3[0].uri, docPath)
              );
              const result = this.parsePagesFromDoc(raw.toString());
              if (result.length > 0) { detected = result; readFrom = docPath; break; }
            } catch (e) {
              // file not found or unreadable — try next
            }
          }
          if (detected.length > 0) {
            this.postToast(`${detected.length} halaman terdeteksi dari ${readFrom}.`, 'info');
          } else {
            this.postToast('Tidak ada halaman terdeteksi. Pastikan docs/flow.md sudah dibuat dan memiliki section "Halaman yang Dibutuhkan".', 'warn');
          }
          this.postToWebview({ type: 'suggestedPages', pages: detected });
          break;
        }

        // ── Step 4: tech stack (free text input) ─────────────────────────
        case 'confirmStack': {
          const stackValue = (msg.stackValue as string)?.trim();
          if (!stackValue) {
            this.postToast('Masukkan tech stack terlebih dahulu.', 'warn');
            break;
          }
          this.state.update({ selectedStack: stackValue });
          this.state.setStep(5);
          this.postState();
          break;
        }

        // ── Step 5: generate guides ───────────────────────────────────────
        case 'generateAll': {
          const prompt5 = PromptBuilder.step5Prompt(this.state.getState());
          this.postToWebview({ type: 'showPrompt', prompt: prompt5, nextStep: 6, mode: 'generate' });
          break;
        }

        // ── Step 6: scaffold actual project ───────────────────────────────
        case 'scaffoldProject': {
          const prompt6 = PromptBuilder.step6Prompt(this.state.getState());
          this.postToWebview({ type: 'showPrompt', prompt: prompt6, nextStep: null, mode: 'generate' });
          break;
        }

        // ── Shared: user confirmed reviewed prompt → execute by mode ──────
        case 'sendPrompt': {
          const folders = vscode.workspace.workspaceFolders;
          if (!folders && msg.mode !== 'chat') {
            this.postToast('Tidak ada workspace yang terbuka.', 'error');
            break;
          }
          try {
            if (msg.mode === 'chat') {
              // Analysis/discussion — send to Copilot Chat as conversation
              await this.sendToCopilot(msg.prompt);
              this.postToWebview({ type: 'promptSent', files: [] });

            } else if (msg.mode === 'direct') {
              // Deterministic content — write file directly, no LM call
              await FileGenerator.writeDirect(
                msg.filePath,
                msg.prompt,
                folders![0].uri,
                (m) => this.postToast(m, 'info'),
              );
              this.postToWebview({ type: 'promptSent', files: [msg.filePath] });

            } else {
              // Generate mode — open Copilot in agent mode so it creates files directly
              await this.sendToCopilotAgent(msg.prompt);
              this.postToWebview({ type: 'promptSent', files: [], waitingForPaste: true, agentMode: true });
            }
          } catch (err: any) {
            this.postToast('Error: ' + (err?.message ?? String(err)), 'error');
          }
          break;
        }

        // ── Parse pasted Copilot response → write files ───────────────────
        case 'parseAndWrite': {
          const folders2 = vscode.workspace.workspaceFolders;
          if (!folders2) {
            this.postToast('Tidak ada workspace yang terbuka.', 'error');
            break;
          }
          try {
            const files = parseFilesFromResponse(msg.text as string);
            if (files.length === 0) {
              this.postToast(
                'Tidak ada file terdeteksi. Pastikan respons Copilot mengandung blok [[FILE:...]] atau ### FILE:.',
                'warn',
              );
              break;
            }
            for (const file of files) {
              this.postToast(`Menulis ${file.path}...`, 'info');
              const uri = vscode.Uri.joinPath(folders2[0].uri, file.path);
              await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
              await vscode.workspace.fs.writeFile(uri, Buffer.from(file.content, 'utf8'));
            }
            this.postToWebview({ type: 'filesWritten', files: files.map(f => f.path), nextStep: msg.nextStep ?? null });
          } catch (err: any) {
            this.postToast('Error menulis file: ' + (err?.message ?? String(err)), 'error');
          }
          break;
        }

        case 'openFile':
          await this.state.openFile(msg.path);
          break;

        case 'setStep':
          this.state.setStep(msg.step);
          this.postState();
          break;
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private postToWebview(message: object) {
    this._view?.webview.postMessage(message);
  }

  private postState() {
    if (!this._view) return;
    this._view.webview.postMessage({
      type: 'stateUpdate',
      state: this.state.getState(),
      stacks: this.state.getStacks(),
      workspaceReady: this.state.workspaceReady(),
    });
  }

  private postToast(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (!this._view) return;
    this._view.webview.postMessage({ type: 'toast', message, level });
  }

  /**
   * Send a prompt string to GitHub Copilot Chat.
   * Uses the stable `workbench.action.chat.open` command which accepts
   * a query string and opens/focuses the Copilot Chat panel.
   */
  private async sendToCopilot(prompt: string) {
    try {
      // Try agent mode first (Copilot with @workspace)
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
        isPartialQuery: false,
      });
    } catch {
      // Fallback: copy to clipboard and notify user
      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(
        'ArchiGuide: Prompt disalin ke clipboard — paste ke Copilot Chat (Ctrl+Shift+I).',
        'Buka Copilot Chat'
      ).then(action => {
        if (action === 'Buka Copilot Chat') {
          vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        }
      });
    }
  }

  /**
   * Open Copilot in agent mode so it can create files directly in the workspace.
   * Falls back to regular chat if agent mode is unavailable.
   */
  private async sendToCopilotAgent(prompt: string) {
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
        isPartialQuery: false,
        mode: 'agent',
      });
    } catch {
      // Agent mode not available — fall back to regular chat
      await this.sendToCopilot(prompt);
    }
  }

  private parsePagesFromDoc(text: string): string[] {
    const pages: string[] = [];

    // Find heading — any # level, optional leading number (e.g. "## 5. Halaman...")
    const headingRe = /^#{1,4}\s+(?:\d+[.)]\s+)?Halaman yang Dibutuhkan/im;
    const headingMatch = headingRe.exec(text);
    if (!headingMatch) { return pages; }

    // Slice to next heading of any level
    const after = text.slice(headingMatch.index + headingMatch[0].length);
    const nextHeadingIdx = after.search(/^#{1,4}\s/m);
    const section = nextHeadingIdx !== -1 ? after.slice(0, nextHeadingIdx) : after;

    for (const line of section.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { continue; }

      let raw = '';

      if (trimmed.startsWith('|')) {
        // Table row: | Nama Halaman | Deskripsi |
        // Skip separator rows like |---|---|
        const cells = trimmed.split('|').map(s => s.trim()).filter(Boolean);
        if (cells.length > 0 && !/^[-:]+$/.test(cells[0])) {
          raw = cells[0];
        }
      } else {
        // List item: "- Name", "* Name", "1. Name", "1) Name"
        const m = trimmed.match(/^(?:[-*•]|\d+[.)]) +(.+)$/);
        if (m) { raw = m[1]; }
      }

      if (!raw) { continue; }

      // Strip markdown formatting
      let name = raw.replace(/\*\*/g, '').replace(/[*_`]/g, '').trim();
      // Take only text before separator (em-dash, en-dash, colon, pipe, hyphen + space)
      name = name.split(/\s+[—–]\s+|\s*[:|\t]\s*|\s{2,}-\s+/)[0].trim();

      if (name.length >= 2 && name.length <= 50 && !pages.includes(name)) {
        pages.push(name);
      }
    }
    return pages;
  }

  private async previewPage(pageName: string) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    const fileName = pageName.toLowerCase().replace(/\s+/g, '-');
    const uri = vscode.Uri.joinPath(folders[0].uri, `docs/design/${fileName}.html`);
    const panel = vscode.window.createWebviewPanel(
      'archiguide.preview',
      `Preview: ${pageName}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      panel.webview.html = raw.toString();
    } catch {
      panel.webview.html = `<body style="font-family:sans-serif;padding:32px;color:#666">
        <p>File <code>docs/design/${fileName}.html</code> belum ada.</p>
        <p>Klik <strong>Generate halaman ini</strong> di ArchiGuide sidebar, lalu Copilot akan membuatnya.</p>
      </body>`;
    }
  }

  // ── HTML ─────────────────────────────────────────────────────────────────

  private getHtml(): string {
    return /* html */`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;
  color:var(--vscode-foreground);background:var(--vscode-sideBar-background);overflow-y:auto}

.topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;
  border-bottom:1px solid var(--vscode-sideBar-border,var(--vscode-widget-border))}
.logo{display:flex;align-items:center;gap:7px;font-weight:600;font-size:13px}
.logo-icon{width:22px;height:22px;background:var(--vscode-button-background);border-radius:5px;
  display:flex;align-items:center;justify-content:center}
.logo-icon svg{width:13px;height:13px;stroke:var(--vscode-button-foreground);fill:none;
  stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.project-label{font-size:11px;color:var(--vscode-descriptionForeground);
  max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.steps{padding:5px 0;border-bottom:1px solid var(--vscode-sideBar-border,var(--vscode-widget-border))}
.step-item{display:flex;align-items:center;gap:8px;padding:5px 12px;cursor:pointer}
.step-item:hover{background:var(--vscode-list-hoverBackground)}
.step-item.active{background:var(--vscode-list-activeSelectionBackground)}
.step-num{width:18px;height:18px;border-radius:50%;border:1px solid var(--vscode-descriptionForeground);
  display:flex;align-items:center;justify-content:center;font-size:10px;
  color:var(--vscode-descriptionForeground);flex-shrink:0;line-height:1}
.step-num.done{background:var(--vscode-terminal-ansiGreen);border-color:var(--vscode-terminal-ansiGreen);color:#fff}
.step-num.active{background:var(--vscode-button-background);border-color:var(--vscode-button-background);
  color:var(--vscode-button-foreground)}
.step-label{font-size:12px;color:var(--vscode-descriptionForeground)}
.step-item.active .step-label{color:var(--vscode-foreground);font-weight:500}
.step-item.done .step-label{color:var(--vscode-foreground)}

.panel{padding:12px}
.sec{font-size:10px;font-weight:600;color:var(--vscode-descriptionForeground);
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.info{background:var(--vscode-textBlockQuote-background,rgba(0,122,204,.08));
  border-left:2px solid var(--vscode-button-background);
  border-radius:0 3px 3px 0;padding:7px 9px;font-size:11px;
  color:var(--vscode-descriptionForeground);margin-bottom:10px;line-height:1.55}
.info.warn{border-color:#f0a500;background:rgba(240,165,0,.08)}

label{display:block;font-size:11px;color:var(--vscode-descriptionForeground);
  margin-top:9px;margin-bottom:3px}
label:first-child{margin-top:0}
input,textarea,select{width:100%;background:var(--vscode-input-background);
  color:var(--vscode-input-foreground);
  border:1px solid var(--vscode-input-border,var(--vscode-widget-border));
  border-radius:3px;padding:6px 8px;font-size:12px;font-family:inherit;
  outline:none;resize:vertical}
input:focus,textarea:focus,select:focus{border-color:var(--vscode-focusBorder)}

.btn{width:100%;padding:7px 10px;border:none;border-radius:3px;font-size:12px;
  cursor:pointer;font-family:inherit;display:flex;align-items:center;
  justify-content:center;gap:5px;margin-top:7px;transition:opacity .15s}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-primary:not(:disabled):hover{background:var(--vscode-button-hoverBackground)}
.btn-secondary{background:transparent;color:var(--vscode-foreground);
  border:1px solid var(--vscode-widget-border)}
.btn-secondary:not(:disabled):hover{background:var(--vscode-list-hoverBackground)}
.btn-sm{width:auto;padding:4px 9px;font-size:11px;margin-top:0}

.theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px}
.theme-card{padding:7px 9px;border:1px solid var(--vscode-widget-border);border-radius:4px;
  cursor:pointer;display:flex;align-items:center;gap:7px;font-size:12px;transition:border-color .1s}
.theme-card:hover{border-color:var(--vscode-focusBorder)}
.theme-card.sel{border-color:var(--vscode-button-background);
  background:var(--vscode-list-hoverBackground)}
.theme-dot{width:13px;height:13px;border-radius:50%;flex-shrink:0}

.page-row{display:flex;align-items:center;justify-content:space-between;
  padding:5px 8px;background:var(--vscode-editor-background);
  border:1px solid var(--vscode-widget-border);border-radius:3px;margin-bottom:4px}
.page-left{display:flex;align-items:center;gap:6px;font-size:12px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.page-actions{display:flex;gap:3px;flex-shrink:0}
.icon-btn{background:none;border:none;cursor:pointer;
  color:var(--vscode-descriptionForeground);padding:2px 5px;
  border-radius:2px;font-size:11px;line-height:1}
.icon-btn:hover{color:var(--vscode-foreground);background:var(--vscode-list-hoverBackground)}
.add-row{display:flex;gap:6px;margin-top:6px;align-items:center}
.add-row input{flex:1}

.stack-item{padding:8px 10px;border:1px solid var(--vscode-widget-border);
  border-radius:4px;cursor:pointer;margin-bottom:5px;transition:border-color .1s}
.stack-item:hover{border-color:var(--vscode-focusBorder)}
.stack-item.sel{border-color:var(--vscode-button-background);
  background:var(--vscode-list-hoverBackground)}
.stack-name{font-size:12px;font-weight:500}
.stack-type{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:1px}

.file-row{display:flex;align-items:center;justify-content:space-between;
  padding:5px 8px;background:var(--vscode-editor-background);
  border:1px solid var(--vscode-widget-border);border-radius:3px;margin-bottom:4px}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-right:6px}
.dot-done{background:var(--vscode-terminal-ansiGreen)}
.dot-pend{background:var(--vscode-descriptionForeground);opacity:.35}
code{font-size:11px;font-family:var(--vscode-editor-font-family,monospace)}

.divider{border:none;border-top:1px solid var(--vscode-widget-border);margin:10px 0}

#toast{position:sticky;bottom:0;left:0;right:0;padding:7px 12px;font-size:12px;
  display:none;border-top:1px solid var(--vscode-widget-border);
  background:var(--vscode-editor-background)}
#toast.show{display:block}
#toast.warn{color:#f0a500}
#toast.error{color:var(--vscode-errorForeground)}

.hero{text-align:center;padding:28px 16px}
.hero-icon{font-size:36px;margin-bottom:12px}
.hero-title{font-size:14px;font-weight:600;margin-bottom:6px}
.hero-sub{font-size:12px;color:var(--vscode-descriptionForeground);
  line-height:1.55;margin-bottom:16px}
</style>
</head>
<body>

<div class="topbar">
  <div class="logo">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24"><path d="M3 21l9-18 9 18"/><path d="M6.5 15h11"/></svg>
    </div>
    ArchiGuide
  </div>
  <span class="project-label" id="proj-label"></span>
</div>

<div class="steps" id="steps-nav" style="display:none"></div>
<div class="panel" id="panel">
  <div class="hero">
    <div class="hero-icon">&#128193;</div>
    <div class="hero-title">Buat project baru</div>
    <div class="hero-sub">ArchiGuide akan membuat folder project dan menyiapkan semua file secara otomatis.</div>
    <label style="text-align:left;display:block;margin-bottom:4px">Nama project</label>
    <input id="ws-name" type="text" placeholder="contoh: SiKas" style="margin-bottom:10px" data-enter="createWorkspace"/>
    <button class="btn btn-primary" data-action="createWorkspace" style="width:100%;margin-top:0">Pilih lokasi &amp; buat project &#8594;</button>
  </div>
</div>
<div id="toast"></div>

<script>
(function () {
  // ── Bootstrap ─────────────────────────────────────────────────────────────
  let vscode;
  try {
    vscode = acquireVsCodeApi();
  } catch (e) {
    showToast('acquireVsCodeApi gagal: ' + e, 'error');
  }

  function post(msg) { if (vscode) { vscode.postMessage(msg); } }

  let S = null, stacks = [], wsReady = false;
  let suggestedPages = [];
  // Prompt review state — ephemeral, not persisted
  let promptPreview = null;
  let promptSent = false;

  // ── Event delegation — handles ALL clicks and Enter keys ──────────────────
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) { return; }
    dispatch(el.dataset.action, el.dataset);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') { return; }
    const action = e.target.dataset && e.target.dataset.enter;
    if (action) { dispatch(action, e.target.dataset); }
  });

  function dispatch(action, data) {
    switch (action) {
      case 'createWorkspace':    createWorkspace(); break;
      case 'submitStep1':        submitStep1(); break;
      case 'addReferenceFile':   post({ type: 'addReferenceFile' }); break;
      case 'removeReferenceFile': post({ type: 'removeReferenceFile', path: data.path }); break;
      case 'submitStep2':        submitStep2(); break;
      case 'openFile':           post({ type: 'openFile', path: data.path }); break;
      case 'addPage':            addPage(); break;
      case 'addSuggestedPage':
        post({ type: 'addPage', pageName: data.page });
        suggestedPages = suggestedPages.filter(function(p) { return p !== data.page; });
        break;
      case 'detectPages':        post({ type: 'detectPages' }); break;
      case 'removePage':         post({ type: 'removePage', pageName: data.page }); break;
      case 'generatePage':       post({ type: 'generatePage', pageName: data.page }); break;
      case 'previewPage':        post({ type: 'previewPage', pageName: data.page }); break;
      case 'generateAllPages':   post({ type: 'generateAllPages' }); break;
      case 'selectStackPreset': {
        const el = document.getElementById('s4-stack');
        if (el) { el.value = data.stack; el.focus(); }
        break;
      }
      case 'confirmStack': {
        const el = document.getElementById('s4-stack');
        const val = el ? el.value.trim() : (S.selectedStack || '');
        if (!val) { showToast('Masukkan tech stack terlebih dahulu.', 'warn'); break; }
        post({ type: 'confirmStack', stackValue: val });
        break;
      }
      case 'generateAll':        post({ type: 'generateAll' }); break;
      case 'scaffoldProject':    post({ type: 'scaffoldProject' }); break;
      case 'goStep':
        promptPreview = null; promptSent = false;
        post({ type: 'setStep', step: parseInt(data.step, 10) });
        break;
      // ── Prompt review actions ──
      case 'sendPrompt': {
        const ta = document.getElementById('prompt-text');
        const txt = ta ? ta.value : (promptPreview ? promptPreview.prompt : '');
        post({ type: 'sendPrompt', prompt: txt, mode: promptPreview ? promptPreview.mode : 'generate', filePath: promptPreview ? promptPreview.filePath : null });
        break;
      }
      case 'cancelPreview':
        promptPreview = null; promptSent = false;
        renderPanel();
        break;
      case 'resendPrompt':
        promptSent = false; promptPreview.waitingForPaste = false; promptPreview.filesWritten = false;
        renderPanel();
        break;
      case 'parseAndWrite': {
        const ta = document.getElementById('paste-text');
        const txt = ta ? ta.value.trim() : '';
        if (!txt) { showToast('Tempel respons Copilot terlebih dahulu.', 'warn'); break; }
        post({ type: 'parseAndWrite', text: txt, nextStep: promptPreview ? promptPreview.nextStep : null });
        break;
      }
    }
  }

  // ── Messages from extension ───────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    const m = e.data;
    if (m.type === 'stateUpdate') {
      const prevStep = S ? S.currentStep : -1;
      S = m.state; stacks = m.stacks; wsReady = m.workspaceReady;
      if (S.currentStep !== prevStep) {
        promptPreview = null; promptSent = false;
        // Auto-detect pages when entering step 3
        if (S.currentStep === 3) { suggestedPages = []; post({ type: 'detectPages' }); }
      }
      render();
    }
    if (m.type === 'suggestedPages') {
      // Filter out pages already added
      suggestedPages = (m.pages || []).filter(function(p) { return !(S && S.pages.includes(p)); });
      renderPanel();
    }
    if (m.type === 'showPrompt') {
      promptPreview = { prompt: m.prompt, nextStep: m.nextStep, mode: m.mode, filePath: m.filePath || null };
      promptSent = false;
      renderPanel();
    }
    if (m.type === 'promptSent') {
      promptSent = true;
      promptPreview.sentFiles = m.files || [];
      promptPreview.waitingForPaste = m.waitingForPaste || false;
      promptPreview.agentMode = m.agentMode || false;
      promptPreview.filesWritten = false;
      renderPanel();
    }
    if (m.type === 'filesWritten') {
      promptPreview.sentFiles = m.files || [];
      promptPreview.waitingForPaste = false;
      promptPreview.filesWritten = true;
      if (m.nextStep) { promptPreview.nextStep = m.nextStep; }
      renderPanel();
    }
    if (m.type === 'toast') { showToast(m.message, m.level); }
  });

  post({ type: 'ready' });

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    document.getElementById('proj-label').textContent = S.projectName || '';
    const nav = document.getElementById('steps-nav');
    if (!wsReady || S.currentStep === 0) {
      nav.style.display = 'none';
    } else {
      nav.style.display = 'block';
      renderSteps();
    }
    renderPanel();
  }

  function renderSteps() {
    const labels = ['Input', 'Dokumen & Style', 'Desain', 'Tech Stack', 'Panduan', 'Scaffold'];
    document.getElementById('steps-nav').innerHTML = labels.map(function (l, i) {
      const n = i + 1;
      const done = n < S.currentStep, active = n === S.currentStep;
      return '<div class="step-item' + (active ? ' active' : '') + (done ? ' done' : '') + '" data-action="goStep" data-step="' + n + '">'
        + '<div class="step-num' + (done ? ' done' : '') + (active ? ' active' : '') + '">' + (done ? '&#10003;' : n) + '</div>'
        + '<span class="step-label">' + l + '</span></div>';
    }).join('');
  }

  function renderPanel() {
    const p = document.getElementById('panel');
    if (!wsReady || S.currentStep === 0) { p.innerHTML = renderFolderPicker(); return; }
    if (promptPreview) { p.innerHTML = renderPromptPreview(); return; }
    switch (S.currentStep) {
      case 1: p.innerHTML = renderStep1(); break;
      case 2: p.innerHTML = renderStep2(); break;
      case 3: p.innerHTML = renderStep3(); break;
      case 4: p.innerHTML = renderStep4(); break;
      case 5: p.innerHTML = renderStep5(); break;
      case 6: p.innerHTML = renderStep6(); break;
    }
  }

  /* ── Prompt review panel ── */
  function renderPromptPreview() {
    const mode = promptPreview.mode || 'generate';

    // ── State: waiting — agent mode or paste fallback ────────────────────────
    if (promptSent && mode === 'generate' && !promptPreview.filesWritten) {
      const nextBtn = promptPreview.nextStep
        ? '<button class="btn btn-primary" data-action="goStep" data-step="' + promptPreview.nextStep + '" style="margin-top:4px">File sudah terbuat &#8212; Lanjut ke Step ' + promptPreview.nextStep + ' &#8594;</button>'
        : '';
      return '<div class="sec">Copilot Agent sedang bekerja</div>'
        + '<div class="info">Prompt dikirim ke <strong>Copilot Agent</strong>. '
        + 'Agent akan membuat file langsung di workspace &#8212; Anda bisa melihat prosesnya di panel Copilot.</div>'
        + nextBtn
        + '<hr class="divider"/>'
        + '<div class="sec" style="margin-top:4px">Fallback: tempel manual</div>'
        + '<div class="info warn">Jika Agent tidak membuat file otomatis, copy seluruh respons Copilot dan tempel di sini.</div>'
        + '<textarea id="paste-text" rows="8" placeholder="Tempel respons Copilot di sini..." '
        + 'style="font-size:11px;font-family:var(--vscode-editor-font-family,monospace);margin-bottom:6px"></textarea>'
        + '<button class="btn btn-secondary" data-action="parseAndWrite">&#128196; Buat file dari tempel ini</button>'
        + '<button class="btn btn-secondary" data-action="resendPrompt" style="margin-top:4px">&#8635; Kirim ulang</button>'
        + '<button class="btn btn-secondary" data-action="cancelPreview">&#8592; Kembali ke form</button>';
    }

    // ── State: success (files written, or chat prompt sent) ─────────────────
    if (promptSent && (mode !== 'generate' || promptPreview.filesWritten)) {
      const files = promptPreview.sentFiles || [];
      const fileRows = files.map(function(f) {
        return '<div class="file-row"><div style="display:flex;align-items:center">'
          + '<div class="dot dot-done"></div><code>' + esc(f) + '</code></div>'
          + '<button class="btn btn-secondary btn-sm" data-action="openFile" data-path="' + esc(f) + '">Buka</button></div>';
      }).join('');

      const successMsg = mode === 'chat'
        ? 'Prompt dikirim ke Copilot Chat. Review hasil diskusi di panel Copilot.'
        : files.length + ' file berhasil dibuat di workspace.';

      const nextBtn = promptPreview.nextStep
        ? '<button class="btn btn-primary" data-action="goStep" data-step="' + promptPreview.nextStep + '">Lanjut ke Step ' + promptPreview.nextStep + ' &#8594;</button>'
        : '';

      return '<div class="sec">Selesai</div>'
        + '<div class="info">' + successMsg + (promptPreview.nextStep ? ' Klik <strong>Lanjut</strong> jika sudah puas dengan hasilnya.' : '') + '</div>'
        + (fileRows ? '<div style="margin-bottom:8px">' + fileRows + '</div>' : '')
        + nextBtn
        + '<button class="btn btn-secondary" data-action="resendPrompt" style="margin-top:6px">&#8635; Ulangi</button>'
        + '<button class="btn btn-secondary" data-action="cancelPreview">&#8592; Kembali ke form</button>';
    }

    // ── State: review prompt before sending ──────────────────────────────────
    const modeInfo = {
      'generate': '&#128172; Prompt ini akan dikirim ke Copilot Chat. Setelah Copilot menjawab, Anda akan diminta menempel hasilnya agar file bisa dibuat.',
      'direct':   '&#128196; File akan ditulis langsung ke workspace tanpa AI.',
      'chat':     '&#128172; Prompt ini akan dikirim ke Copilot Chat untuk diskusi (tidak membuat file).',
    }[mode] || '';
    const sendLabel = mode === 'direct' ? 'Tulis file langsung &#8594;' : 'Kirim ke Copilot Chat &#8594;';
    const promptLabel = mode === 'direct' ? 'Konten file yang akan ditulis' : 'Review prompt sebelum dikirim';

    return '<div class="sec">' + promptLabel + '</div>'
      + '<div class="info warn">' + modeInfo + ' Edit jika perlu.</div>'
      + '<textarea id="prompt-text" rows="13" style="font-size:11px;font-family:var(--vscode-editor-font-family,monospace);margin-bottom:6px">' + esc(promptPreview.prompt) + '</textarea>'
      + '<button class="btn btn-primary" data-action="sendPrompt">' + sendLabel + '</button>'
      + '<button class="btn btn-secondary" data-action="cancelPreview">&#8592; Kembali</button>';
  }

  /* ── Step 0: folder picker ── */
  function renderFolderPicker() {
    return '<div class="hero">'
      + '<div class="hero-icon">&#128193;</div>'
      + '<div class="hero-title">Buat project baru</div>'
      + '<div class="hero-sub">ArchiGuide akan membuat folder project dan menyiapkan semua file secara otomatis.</div>'
      + '<label style="text-align:left;display:block;margin-bottom:4px">Nama project</label>'
      + '<input id="ws-name" type="text" placeholder="contoh: SiKas" style="margin-bottom:10px" data-enter="createWorkspace"/>'
      + '<button class="btn btn-primary" data-action="createWorkspace" style="width:100%;margin-top:0">Pilih lokasi &amp; buat project &#8594;</button>'
      + '</div>';
  }
  function createWorkspace() {
    const el = document.getElementById('ws-name');
    const name = el ? el.value.trim() : '';
    if (!name) { showToast('Isi nama project terlebih dahulu.', 'warn'); return; }
    showToast('Membuka dialog pilih folder...', 'info');
    post({ type: 'createWorkspace', projectName: name });
  }

  /* ── Step 1 ── */
  function renderStep1() {
    const refs = S.referenceFiles || [];
    const refRows = refs.map(function(f) {
      const fname = f.split('/').pop();
      return '<div class="page-row">'
        + '<div class="page-left">&#128206; ' + esc(fname) + '</div>'
        + '<div class="page-actions">'
        + '<button class="icon-btn" title="Buka" data-action="openFile" data-path="' + esc(f) + '">&#128065;</button>'
        + '<button class="icon-btn" title="Hapus" data-action="removeReferenceFile" data-path="' + esc(f) + '">&#10005;</button>'
        + '</div></div>';
    }).join('');
    return '<div class="sec">Deskripsi sistem</div>'
      + '<div class="info">Ceritakan sistem yang ingin dibuat. Copilot Agent akan membuat <code>docs/FSD.md</code> dan <code>docs/flow.md</code>.</div>'
      + '<label>Nama proyek</label>'
      + '<input id="s1-name" placeholder="contoh: SiKas &#8212; Sistem Kasir Toko" value="' + esc(S.projectName) + '"/>'
      + '<label>Deskripsi sistem</label>'
      + '<textarea id="s1-desc" rows="6" placeholder="Jelaskan sistem: siapa penggunanya, apa yang bisa dilakukan, fitur utama...">' + esc(S.systemDescription) + '</textarea>'
      + '<hr class="divider"/>'
      + '<div class="sec">Dokumen referensi <span style="font-weight:400;text-transform:none">(opsional)</span></div>'
      + '<div class="info">Lampirkan spesifikasi, wireframe, atau catatan sebagai sumber tambahan untuk Copilot.</div>'
      + (refRows || '')
      + '<button class="btn btn-secondary" data-action="addReferenceFile" style="margin-bottom:8px">+ Lampirkan dokumen referensi</button>'
      + '<button class="btn btn-primary" data-action="submitStep1">Kirim ke Copilot Agent &#8212; buat FSD &amp; flow &#8594;</button>';
  }
  function submitStep1() {
    post({ type: 'submitStep1',
      projectName: document.getElementById('s1-name').value,
      systemDescription: document.getElementById('s1-desc').value });
  }
  function submitStep2() {
    const val = document.getElementById('s2-style');
    post({ type: 'submitStep2', styleDescription: val ? val.value : '' });
  }

  /* ── Step 2 ── */
  function renderStep2() {
    return '<div class="sec">Dokumen</div>'
      + '<div class="info">Review dokumen yang sudah dibuat, lalu deskripsikan tampilan visual yang Anda inginkan.</div>'
      + '<div class="file-row"><div style="display:flex;align-items:center"><div class="dot dot-done"></div><code>docs/FSD.md</code></div>'
      + '<button class="btn btn-secondary btn-sm" data-action="openFile" data-path="docs/FSD.md">Buka</button></div>'
      + '<div class="file-row"><div style="display:flex;align-items:center"><div class="dot dot-done"></div><code>docs/flow.md</code></div>'
      + '<button class="btn btn-secondary btn-sm" data-action="openFile" data-path="docs/flow.md">Buka</button></div>'
      + '<hr class="divider"/>'
      + '<div class="sec">Style visual</div>'
      + '<div class="info">Deskripsikan warna, font, dan gaya yang diinginkan. Copilot Agent akan membuat <code>.archiguide/design-tokens.json</code>.</div>'
      + '<textarea id="s2-style" rows="4" placeholder="Contoh: Warna utama biru tua #1e3a5f, tampilan profesional minimalis, sudut sedikit bulat, font Poppins atau Inter">'
      + esc(S.styleDescription || '') + '</textarea>'
      + '<button class="btn btn-primary" data-action="submitStep2" style="margin-top:7px">Generate design tokens &#8594;</button>'
      + '<button class="btn btn-secondary" data-action="goStep" data-step="1">&#8592; Kembali</button>';
  }

  /* ── Step 3 ── */
  function renderStep3() {
    // Suggested (auto-detected) pages not yet added
    const pending = suggestedPages.filter(function(p) { return !S.pages.includes(p); });
    const suggestRows = pending.map(function(p) {
      return '<div class="page-row" style="border-style:dashed;opacity:.8">'
        + '<div class="page-left">&#128161; ' + esc(p) + '</div>'
        + '<div class="page-actions">'
        + '<button class="btn btn-secondary btn-sm" data-action="addSuggestedPage" data-page="' + esc(p) + '">+ Tambah</button>'
        + '</div></div>';
    }).join('');

    const rows = S.pages.map(function (p) {
      return '<div class="page-row">'
        + '<div class="page-left">&#128196; ' + esc(p) + '</div>'
        + '<div class="page-actions">'
        + '<button class="icon-btn" title="Generate via Copilot" data-action="generatePage" data-page="' + esc(p) + '">&#9889;</button>'
        + '<button class="icon-btn" title="Preview" data-action="previewPage" data-page="' + esc(p) + '">&#128065;</button>'
        + '<button class="icon-btn" title="Hapus" data-action="removePage" data-page="' + esc(p) + '">&#10005;</button>'
        + '</div></div>';
    }).join('');

    const noPages = !S.pages.length && !pending.length;
    return '<div class="sec">Halaman desain</div>'
      + '<div class="info">Halaman terdeteksi otomatis dari <code>docs/flow.md</code>. Tambah jika ada yang kurang, lalu klik &#9889; untuk generate HTML-nya.</div>'
      + '<button class="btn btn-secondary" data-action="detectPages" style="margin-bottom:8px">&#128269; Deteksi ulang dari dokumen</button>'
      + (pending.length ? '<div class="sec" style="margin-bottom:4px">Terdeteksi dari dokumen</div>' + suggestRows : '')
      + (S.pages.length ? '<div class="sec" style="margin-top:8px;margin-bottom:4px">Halaman ditambahkan</div>' + rows : '')
      + (noPages ? '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:8px">Belum ada halaman. Klik "Deteksi ulang" atau tambah manual.</div>' : '')
      + '<div class="add-row" style="margin-top:6px">'
      + '<input id="s3-page" placeholder="Tambah halaman manual..." data-enter="addPage"/>'
      + '<button class="btn btn-primary btn-sm" data-action="addPage">+ Tambah</button>'
      + '</div>'
      + '<hr class="divider"/>'
      + '<button class="btn btn-primary" data-action="generateAllPages"' + (S.pages.length === 0 ? ' disabled' : '') + '>&#9889; Generate semua halaman</button>'
      + '<button class="btn btn-primary" data-action="goStep" data-step="4" style="margin-top:6px">Lanjut ke Step 4 &#8594;</button>'
      + '<button class="btn btn-secondary" data-action="goStep" data-step="2">&#8592; Kembali</button>';
  }
  function addPage() {
    const el = document.getElementById('s3-page');
    if (el && el.value.trim()) { post({ type: 'addPage', pageName: el.value }); el.value = ''; }
  }

  /* ── Step 4 ── */
  function renderStep4() {
    const chips = stacks.map(function(st) {
      return '<button class="btn btn-secondary btn-sm" style="margin:3px 3px 0 0;width:auto" '
        + 'data-action="selectStackPreset" data-stack="' + esc(st.label) + '">'
        + esc(st.label) + '</button>';
    }).join('');
    return '<div class="sec">Tech stack</div>'
      + '<div class="info">Masukkan tech stack yang akan digunakan. Bisa kombinasi apa saja sesuai kebutuhan proyek.</div>'
      + '<label>Stack yang digunakan</label>'
      + '<input id="s4-stack" placeholder="Contoh: Laravel + Vue.js + MySQL, Next.js + Prisma + PostgreSQL..." '
      + 'value="' + esc(S.selectedStack) + '" data-enter="confirmStack"/>'
      + '<div class="sec" style="margin-top:10px">Preset cepat</div>'
      + '<div style="display:flex;flex-wrap:wrap;margin-bottom:10px">' + chips + '</div>'
      + '<hr class="divider"/>'
      + '<button class="btn btn-primary" data-action="confirmStack">Lanjut &#8212; generate project &#8594;</button>'
      + '<button class="btn btn-secondary" data-action="goStep" data-step="3">&#8592; Kembali</button>';
  }

  /* ── Step 5 ── */
  function renderStep5() {
    const guides = [
      'docs/copilot-guides/backend-guide.md',
      'docs/copilot-guides/frontend-guide.md',
      '.github/copilot-instructions.md',
    ];
    const guideRows = guides.map(function(f) {
      return '<div class="file-row"><div style="display:flex;align-items:center">'
        + '<div class="dot dot-pend"></div><code>' + f + '</code></div>'
        + '<button class="btn btn-secondary btn-sm" data-action="openFile" data-path="' + esc(f) + '">Buka</button></div>';
    }).join('');
    return '<div class="sec">Generate panduan developer</div>'
      + '<div class="info">Copilot Agent akan membuat tiga file panduan siap pakai untuk developer yang mengerjakan proyek ini.</div>'
      + guideRows
      + '<button class="btn btn-primary" data-action="generateAll" style="margin-top:10px">&#9889; Generate panduan (backend, frontend, Copilot instructions)</button>'
      + '<hr class="divider"/>'
      + '<button class="btn btn-primary" data-action="goStep" data-step="6">Lanjut ke Scaffold Project &#8594;</button>'
      + '<button class="btn btn-secondary" data-action="goStep" data-step="3">&#8592; Kembali ke halaman</button>';
  }

  /* ── Step 6 ── */
  function renderStep6() {
    const stack = S.selectedStack || '(belum dipilih)';
    const safeName = (S.projectName || '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const pageRows = S.pages.map(function(p) {
      const f = p.toLowerCase().replace(/\s+/g, '-');
      return '<div class="file-row"><div style="display:flex;align-items:center">'
        + '<div class="dot dot-done"></div><code>docs/design/' + esc(f) + '.html</code></div>'
        + '<button class="btn btn-secondary btn-sm" data-action="previewPage" data-page="' + esc(p) + '">Preview</button></div>';
    }).join('');
    return '<div class="sec">Scaffold Project</div>'
      + '<div class="info">Copilot Agent akan menjalankan perintah scaffold, membuat struktur folder dan file awal di <code>project/</code>, serta menyesuaikan konfigurasi berdasarkan panduan yang sudah dibuat.</div>'
      + '<div class="file-row"><div style="display:flex;align-items:center"><div class="dot dot-done"></div>'
      + '<span style="font-size:12px">Stack: <strong>' + esc(stack) + '</strong></span></div></div>'
      + '<div class="file-row"><div style="display:flex;align-items:center"><div class="dot dot-done"></div>'
      + '<span style="font-size:12px">Target folder: <code>project/' + esc(safeName) + '/</code></span></div></div>'
      + (pageRows ? '<div class="sec" style="margin-top:8px">HTML prototype siap</div>' + pageRows : '')
      + '<hr class="divider"/>'
      + '<button class="btn btn-primary" data-action="scaffoldProject" style="margin-top:4px">&#9889; Generate scaffold project &#8594;</button>'
      + '<hr class="divider"/>'
      + '<div class="sec">Setelah scaffold</div>'
      + '<div class="info warn">Buka folder <code>project/</code> sebagai workspace baru, lalu gunakan panduan developer untuk mulai coding bersama Copilot.</div>'
      + '<button class="btn btn-secondary" data-action="openFile" data-path="docs/copilot-guides/backend-guide.md">&#128196; Backend guide</button>'
      + '<button class="btn btn-secondary" data-action="openFile" data-path="docs/copilot-guides/frontend-guide.md">&#128196; Frontend guide</button>'
      + '<button class="btn btn-secondary" data-action="goStep" data-step="5">&#8592; Kembali ke panduan</button>';
  }

  /* ── Utils ── */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function showToast(msg, level) {
    const t = document.getElementById('toast');
    if (!t) { return; }
    t.textContent = msg;
    t.className = 'show' + (level === 'warn' ? ' warn' : level === 'error' ? ' error' : '');
    setTimeout(function () { t.className = ''; }, 3500);
  }
})();
</script>
</body>
</html>`;
  }
}
