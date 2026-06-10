# ArchiGuide

**From idea to project scaffold — guided by Copilot Agent.**

ArchiGuide is a VSCode extension that guides you from a system idea to real scaffolded code, using GitHub Copilot Agent as the executor at every step.

> **Requires:** GitHub Copilot (active) · VSCode 1.90+

---

## Installation

Search for **ArchiGuide** in the VSCode Extensions Marketplace and click **Install**.

Or via Command Palette (`Ctrl+Shift+P`):
```
ext install vikhandev.archiguide
```

---

## How it works

After installing, click the **ArchiGuide** icon (triangle "A") in the left Activity Bar.

ArchiGuide guides you through 6 steps:

### Step 1 — Input & References
- Enter your project name and system description
- Optionally attach specification documents (PDF, MD, DOCX) as reference
- Copilot Agent creates `docs/FSD.md` (for stakeholders) and `docs/flow.md` (for developers)

### Step 2 — Documents & Style
- Review the generated documents
- Describe the visual style you want (colors, fonts, look & feel)
- Copilot Agent creates `.archiguide/design-tokens.json`

### Step 3 — Page Design
- Pages are auto-detected from `docs/flow.md`
- Add or remove pages manually as needed
- Copilot Agent generates an HTML prototype for each page in `docs/design/`

### Step 4 — Tech Stack
- Enter the stack you want to use (any combination: Laravel + Vue, Next.js, Django, etc.)
- Quick presets available for popular stacks

### Step 5 — Generate Developer Guides
- Copilot Agent creates three guide files:
  - `docs/copilot-guides/backend-guide.md` — ready-to-use backend prompts
  - `docs/copilot-guides/frontend-guide.md` — HTML-to-component conversion guide
  - `.github/copilot-instructions.md` — auto-loaded context for every Copilot request

### Step 6 — Scaffold Project
- Copilot Agent runs the scaffold command for your chosen stack
- Folder structure and initial files are created inside `project/`
- Ready to develop with Copilot using the generated guides

---

## Output folder structure

```
workspace/
├── .archiguide/
│   ├── config.json              ← ArchiGuide state
│   └── design-tokens.json       ← colors, fonts, border-radius
├── .github/
│   └── copilot-instructions.md  ← auto-loaded Copilot context
├── docs/
│   ├── FSD.md                   ← functional specification
│   ├── flow.md                  ← technical flow document
│   ├── references/              ← attached reference documents
│   ├── design/
│   │   └── *.html               ← HTML prototype per page
│   └── copilot-guides/
│       ├── backend-guide.md
│       └── frontend-guide.md
└── project/                     ← scaffolded framework code
```

---

## Language

ArchiGuide supports **English** and **Bahasa Indonesia**. Toggle the language using the button in the top-right corner of the sidebar.

---

## Requirements

- **VSCode** 1.90 or later
- **GitHub Copilot** installed and active (required for generating documents, designs, and scaffold)

---

## For Developers

Want to contribute or modify the extension?

```bash
git clone https://github.com/vikhanmuhammad/archiguide
cd archiguide
npm install
npm run compile
```

Press **F5** in VSCode to open an Extension Development Host.

| File | Role |
|------|------|
| `src/extension.ts` | Entry point, command registration |
| `src/sidebarProvider.ts` | Sidebar UI & message handlers |
| `src/promptBuilder.ts` | Copilot prompt templates |
| `src/stateManager.ts` | State, file I/O, workspace setup |
| `src/fileGenerator.ts` | Copilot response parser → files |

After any change in `src/` → `npm run compile` → **Ctrl+R** in the Extension Host window.

To build a `.vsix` file:
```bash
npx vsce package
```

---
---

# ArchiGuide

**Dari ide sistem hingga scaffold project — dipandu Copilot Agent.**

ArchiGuide adalah VSCode extension yang memandu Anda membangun sistem dari deskripsi ide hingga scaffold kode nyata, menggunakan GitHub Copilot Agent sebagai eksekutor di setiap langkah.

> **Diperlukan:** GitHub Copilot (aktif) · VSCode 1.90+

---

## Instalasi

Cari **ArchiGuide** di VSCode Extensions Marketplace, lalu klik **Install**.

Atau via Command Palette (`Ctrl+Shift+P`):
```
ext install vikhandev.archiguide
```

---

## Cara penggunaan

Setelah install, klik ikon **ArchiGuide** (segitiga "A") di Activity Bar kiri.

ArchiGuide membimbing Anda melalui 6 langkah:

### Step 1 — Input & Referensi
- Masukkan nama proyek dan deskripsi sistem
- Lampirkan dokumen spesifikasi (PDF, MD, DOCX) sebagai referensi opsional
- Copilot Agent membuat `docs/FSD.md` (untuk stakeholder) dan `docs/flow.md` (untuk developer)

### Step 2 — Dokumen & Style
- Review dokumen yang dihasilkan
- Deskripsikan tampilan visual yang diinginkan (warna, font, gaya)
- Copilot Agent membuat `.archiguide/design-tokens.json`

### Step 3 — Desain Halaman
- Halaman terdeteksi otomatis dari `docs/flow.md`
- Tambah atau hapus halaman secara manual
- Copilot Agent membuat HTML prototype untuk setiap halaman di `docs/design/`

### Step 4 — Tech Stack
- Masukkan stack yang akan digunakan (bebas: Laravel + Vue, Next.js, Django, dll.)
- Tersedia preset cepat untuk stack populer

### Step 5 — Generate Panduan Developer
- Copilot Agent membuat tiga file panduan:
  - `docs/copilot-guides/backend-guide.md` — prompt siap pakai untuk backend
  - `docs/copilot-guides/frontend-guide.md` — panduan konversi HTML ke komponen
  - `.github/copilot-instructions.md` — konteks otomatis untuk setiap Copilot request

### Step 6 — Scaffold Project
- Copilot Agent menjalankan perintah scaffold sesuai stack yang dipilih
- Struktur folder dan file awal dibuat di `project/`
- Siap dikembangkan dengan Copilot menggunakan panduan yang sudah dibuat

---

## Struktur folder yang dihasilkan

```
workspace/
├── .archiguide/
│   ├── config.json              ← state ArchiGuide
│   └── design-tokens.json       ← warna, font, border-radius
├── .github/
│   └── copilot-instructions.md  ← konteks otomatis Copilot
├── docs/
│   ├── FSD.md                   ← spesifikasi fungsional
│   ├── flow.md                  ← dokumen teknis & alur
│   ├── references/              ← dokumen referensi yang dilampirkan
│   ├── design/
│   │   └── *.html               ← HTML prototype per halaman
│   └── copilot-guides/
│       ├── backend-guide.md
│       └── frontend-guide.md
└── project/                     ← scaffold framework
```

---

## Bahasa

ArchiGuide mendukung **Bahasa Indonesia** (default) dan **English**. Toggle bahasa tersedia di pojok kanan atas sidebar.

---

## Persyaratan

- **VSCode** 1.90 atau lebih baru
- **GitHub Copilot** terinstall dan aktif (diperlukan untuk generate dokumen, desain, dan scaffold)

---

## Untuk Developer

Ingin berkontribusi atau memodifikasi extension?

```bash
git clone https://github.com/vikhanmuhammad/archiguide
cd archiguide
npm install
npm run compile
```

Tekan **F5** di VSCode untuk membuka Extension Development Host.

| File | Fungsi |
|------|--------|
| `src/extension.ts` | Entry point, registrasi command |
| `src/sidebarProvider.ts` | UI sidebar & message handler |
| `src/promptBuilder.ts` | Template prompt untuk Copilot |
| `src/stateManager.ts` | State, file I/O, workspace setup |
| `src/fileGenerator.ts` | Parser respons Copilot → file |

Setiap perubahan di `src/` → `npm run compile` → **Ctrl+R** di jendela Extension Host.

Untuk build file `.vsix`:
```bash
npx vsce package
```
