# ArchiGuide — Konteks Project untuk Claude

## Apa ini?
VSCode extension bernama **ArchiGuide** — system design assistant yang memandu user dari ide sampai scaffold project, dengan GitHub Copilot Agent sebagai executor.

ArchiGuide **tidak memanggil AI sendiri**. Ia menyusun prompt yang kontekstual lalu mengirimnya ke Copilot Chat via `workbench.action.chat.open`. Copilot yang mengerjakan, ArchiGuide yang mengarahkan.

---

## Arsitektur extension

```
archiguide/
├── src/
│   ├── extension.ts          ← Entry point, registrasi sidebar
│   ├── sidebarProvider.ts    ← Seluruh UI (webview HTML) + message handler
│   ├── stateManager.ts       ← State, file I/O, createAndOpenWorkspace()
│   └── promptBuilder.ts      ← Semua template prompt untuk Copilot
├── media/
│   └── icon.svg
├── package.json              ← Contributes: activitybar + webview sidebar
└── tsconfig.json
```

---

## Flow 5 step

### Step 0 — Buat workspace (layar pertama, sebelum ada workspace)
- Sidebar langsung tampil form: input nama project
- Klik "Pilih lokasi & buat project" → `createAndOpenWorkspace(projectName)`
- `stateManager.createAndOpenWorkspace()`:
  1. Buka dialog pilih parent folder
  2. Buat subfolder `<safeName>` di dalamnya via `workspace.fs.createDirectory`
  3. Tulis `.archiguide/config.json` ke folder baru (berisi state + `currentStep: 1`)
  4. Panggil `vscode.openFolder` → VSCode reload window
  5. Setelah reload, extension baca config.json → lanjut ke Step 1

### Step 1 — Input sistem
- Form: nama project + textarea deskripsi sistem
- Klik "Kirim ke Copilot" → `PromptBuilder.step1Prompt(state)` → `sendToCopilot(prompt)`
- Copilot Agent membuat `docs/FSD.md` dan `docs/flow.md`

### Step 2 — Dokumen & tema
- Tampilkan link buka FSD.md dan flow.md
- Pilih tema visual (4 preset: indigo, emerald, rose, slate) → `design-tokens.json`
- Klik "Kirim ke Copilot" → Copilot buat `.archiguide/design-tokens.json`

### Step 3 — Desain halaman
- User tambah nama halaman satu per satu
- Per halaman: klik ⚡ → `PromptBuilder.step3PagePrompt(pageName, state)` → Copilot buat `docs/design/<nama>.html`
- HTML konsisten: sidebar, topbar, CSS variables dari design token, class: `.btn`, `.card`, `.badge`, dll
- Preview via `vscode.window.createWebviewPanel` (buka di tab editor)
- "Generate semua" → kirim prompt satu per satu dengan delay 800ms

### Step 4 — Tech stack
- "Minta saran Copilot" → `PromptBuilder.step4Prompt(state)` → Copilot baca flow.md dan beri rekomendasi
- Atau pilih manual dari daftar: Laravel+Blade, Laravel+Vue, Node+Angular, Node+React, Django+React
- Konfirmasi → lanjut Step 5

### Step 5 — Generate project
- Klik "Kirim ke Copilot" → `PromptBuilder.step5Prompt(state)`
- Copilot membuat:
  - `docs/copilot-guides/backend-guide.md`
  - `docs/copilot-guides/frontend-guide.md`
  - `.github/copilot-instructions.md`
- Copilot menampilkan perintah scaffold terminal (tidak dijalankan otomatis)
- Setelah step 5, sidebar tetap aktif: bisa tambah halaman baru atau buka guides

---

## Struktur folder yang dihasilkan di workspace

```
<project-name>/
├── .archiguide/
│   ├── config.json           ← State ArchiGuide (persisted across sessions)
│   └── design-tokens.json    ← Warna, font, radius (dibuat Copilot di step 2)
├── .github/
│   └── copilot-instructions.md  ← Konteks otomatis Copilot
├── docs/
│   ├── FSD.md                ← Dokumen stakeholder (dibuat Copilot step 1)
│   ├── flow.md               ← Dokumen teknis (dibuat Copilot step 1)
│   ├── design/
│   │   ├── dashboard.html    ← HTML prototype (dibuat Copilot step 3)
│   │   └── login.html
│   └── copilot-guides/
│       ├── backend-guide.md  ← Template prompt backend (dibuat Copilot step 5)
│       └── frontend-guide.md ← Template prompt frontend (dibuat Copilot step 5)
└── project/                  ← Scaffold framework (user jalankan manual dari terminal)
```

---

## Key implementation details

### sendToCopilot(prompt)
```typescript
await vscode.commands.executeCommand('workbench.action.chat.open', {
  query: prompt,
  isPartialQuery: false,
});
// Fallback: copy to clipboard + notifikasi jika command tidak tersedia
```

### State persistence
- State disimpan ke `.archiguide/config.json` setiap `state.update()` dipanggil
- Dibaca kembali via `initFromWorkspace()` saat extension activate
- Penting: config.json ditulis SEBELUM `vscode.openFolder` karena window akan reload

### Webview communication
- Extension → Webview: `webview.postMessage({ type: 'stateUpdate', state, themes, stacks, workspaceReady })`
- Webview → Extension: `vscode.postMessage({ type: 'submitStep1', projectName, systemDescription })`

### Design tokens (4 tema)
```typescript
indigo:  { primary: '#6366f1', radius: '8px',  font: 'Inter' }
emerald: { primary: '#10b981', radius: '6px',  font: 'Inter' }
rose:    { primary: '#f43f5e', radius: '10px', font: 'Inter' }
slate:   { primary: '#475569', radius: '4px',  font: 'Inter' }
```

---

## Yang belum diimplementasi / bisa dikembangkan
- [ ] Validasi apakah Copilot sudah selesai membuat file sebelum lanjut step
- [ ] Tombol "Refresh" untuk re-generate file yang sudah ada
- [ ] Mode "edit project yang sudah ada" (bukan hanya new project)
- [ ] Tambah lebih banyak stack option
- [ ] Notifikasi/progress indicator saat Copilot sedang bekerja
- [ ] Step 3: auto-detect halaman dari flow.md yang sudah dibuat Copilot

---

## Cara run untuk development
```bash
npm install
npm run compile   # atau: npm run watch
# Buka folder archiguide/ di VSCode, tekan F5
# Jendela Extension Development Host terbuka
# Klik icon ArchiGuide di activity bar kiri
```

Setiap perubahan: `npm run compile` → Ctrl+R di jendela Extension Host.
