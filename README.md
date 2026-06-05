# ArchiGuide — Panduan Setup & Penggunaan

## Prasyarat
- Node.js (sudah terinstall)
- VSCode
- GitHub Copilot (aktif di VSCode)

---

## Langkah 1 — Install dependencies

Buka terminal di folder `archiguide/`, lalu jalankan:

```bash
npm install
```

---

## Langkah 2 — Compile TypeScript

```bash
npm run compile
```

Atau gunakan mode watch (otomatis compile setiap ada perubahan):

```bash
npm run watch
```

---

## Langkah 3 — Jalankan extension

1. Buka folder `archiguide/` di VSCode:
   ```bash
   code .
   ```

2. Tekan **F5** (atau menu Run → Start Debugging)

3. Sebuah jendela VSCode baru akan terbuka — ini adalah **Extension Development Host**

4. Di jendela baru tersebut, **buka folder project yang ingin Anda buat** (File → Open Folder)

5. Klik ikon **ArchiGuide** (segitiga "A") di Activity Bar kiri

---

## Langkah 4 — Mulai gunakan ArchiGuide

### Step 1 — Input sistem
- Isi nama proyek dan deskripsi sistem
- Klik "Lanjut — buat dokumen"
- File `docs/FSD.md` dan `docs/flow.md` otomatis terbuat di workspace

### Step 2 — Dokumen & tema
- Buka dan review `FSD.md` / `flow.md`
- Pilih tema visual (Indigo / Emerald / Rose / Slate)

### Step 3 — Desain halaman
- Tambah nama halaman satu per satu (contoh: Dashboard, Login, Inventory)
- Klik ikon 👁 untuk preview langsung di VSCode
- Klik 📝 untuk buka dan edit HTML-nya
- Klik "Generate semua HTML & lanjut" ketika sudah selesai

### Step 4 — Tech stack
- Pilih framework yang akan digunakan

### Step 5 — Generate proyek
- Klik "Generate semua"
- Copilot guides terbuat di `docs/copilot-guides/`
- Scaffold project berjalan di terminal
- Buka `docs/copilot-guides/backend-guide.md` — copy prompt ke Copilot Chat untuk mulai coding

---

## Struktur folder yang dihasilkan

```
workspace/
├── .archiguide/
│   ├── config.json          ← state ArchiGuide
│   └── design-tokens.json   ← token warna, font, radius
├── .github/
│   └── copilot-instructions.md  ← konteks otomatis untuk Copilot
├── docs/
│   ├── FSD.md               ← dokumen untuk stakeholder
│   ├── flow.md              ← dokumen teknis
│   ├── design/
│   │   ├── dashboard.html   ← prototype HTML tiap halaman
│   │   └── login.html
│   └── copilot-guides/
│       ├── backend-guide.md     ← prompt siap pakai untuk Copilot
│       └── frontend-guide.md
└── project/                 ← scaffold framework
```

---

## Cara pakai Copilot guides

1. Buka `docs/copilot-guides/backend-guide.md`
2. Copy salah satu blok prompt (misalnya "Prompt: Buat Model & Migration")
3. Buka **Copilot Chat** di secondary sidebar VSCode
4. Paste prompt — Copilot sudah punya konteks penuh proyek Anda

---

## Development — edit extension

File utama yang bisa Anda modifikasi:

| File | Fungsi |
|------|--------|
| `src/extension.ts` | Entry point, registrasi command |
| `src/sidebarProvider.ts` | UI sidebar (HTML + logic pesan) |
| `src/promptBuilder.ts` | Semua template dokumen & prompt |
| `src/stateManager.ts` | State, file I/O, tema, stack |

Setiap perubahan di `src/` → jalankan `npm run compile` → tekan **Ctrl+R** di jendela Extension Host untuk reload.
"# archiguide-extension" 
