"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
/**
 * File-generating prompts use [[FILE:path]]...[[/FILE]] delimiters.
 * FileGenerator parses these delimiters and writes files to disk.
 *
 * step4Prompt is chat-only (analysis, no file creation).
 */
class PromptBuilder {
    // ── Step 1 → FSD.md + flow.md ─────────────────────────────────────────────
    static step1Prompt(state) {
        const refSection = state.referenceFiles?.length
            ? `\n\nDokumen referensi tersedia di workspace — baca sebagai sumber spesifikasi tambahan:\n`
                + state.referenceFiles.map(f => `#file:${f}`).join('\n')
            : '';
        return `Buat dua file markdown berikut langsung di workspace ini untuk proyek **${state.projectName}**.\n\n`
            + `**Deskripsi sistem:**\n${state.systemDescription}`
            + refSection + `\n\n`
            + `Gunakan Bahasa Indonesia. Isi dengan konten nyata dan spesifik — jangan gunakan placeholder.\n\n`
            + `---\n\n`
            + `**File 1: \`docs/FSD.md\`** — Functional Specification Document (untuk stakeholder non-teknis)\n\n`
            + `Bagian wajib:\n`
            + `- **Gambaran Sistem** — tulis ulang deskripsi dalam bahasa sehari-hari yang mudah dipahami\n`
            + `- **Siapa Penggunanya** — list setiap role user beserta deskripsinya\n`
            + `- **Fitur Utama** — minimal 5 fitur dalam bahasa non-teknis\n`
            + `- **Alur Penggunaan** — alur naratif per role, langkah demi langkah\n`
            + `- **Batasan Sistem** — apa yang TIDAK dicakup sistem ini\n\n`
            + `---\n\n`
            + `**File 2: \`docs/flow.md\`** — Technical Flow Document (untuk developer)\n\n`
            + `Bagian wajib:\n`
            + `- **Arsitektur Sistem** — komponen utama: frontend, backend, database, layanan eksternal\n`
            + `- **Entitas Data Utama** — setiap entitas/tabel dengan field dan tipe datanya\n`
            + `- **Role & Hak Akses** — setiap role dengan permission spesifiknya\n`
            + `- **Alur Teknis Per Fitur** — per fitur: Input → Proses → Output\n`
            + `- **Halaman yang Dibutuhkan** — WAJIB tulis dengan format PERSIS berikut (heading dan bullet list):\n\n`
            + `## Halaman yang Dibutuhkan\n`
            + `- NamaHalaman1\n`
            + `- NamaHalaman2\n`
            + `- NamaHalaman3\n`
            + `- dst...\n\n`
            + `Setiap baris hanya berisi nama halaman (1–3 kata, tanpa deskripsi di baris yang sama). Minimal 5 halaman.`;
    }
    // ── Step 2 → design-tokens.json via Copilot Agent ─────────────────────────
    static step2Prompt(state) {
        const style = state.styleDescription?.trim()
            || 'tampilan profesional dan modern, warna biru, font Inter';
        return `Buat file \`.archiguide/design-tokens.json\` langsung di workspace ini.\n\n`
            + `**Proyek:** ${state.projectName}\n`
            + `**Style yang diinginkan:** ${style}\n\n`
            + `Buat file JSON dengan struktur PERSIS seperti ini — isi nilainya berdasarkan deskripsi style di atas:\n\n`
            + `\`\`\`json\n`
            + `{\n`
            + `  "theme": "nama-tema-singkat",\n`
            + `  "colors": {\n`
            + `    "primary": "#hex",\n`
            + `    "background": "#hex",\n`
            + `    "surface": "#hex",\n`
            + `    "text": "#hex",\n`
            + `    "textMuted": "#hex",\n`
            + `    "border": "#hex"\n`
            + `  },\n`
            + `  "typography": {\n`
            + `    "fontFamily": "nama font, fallback sans-serif",\n`
            + `    "baseSize": "16px"\n`
            + `  },\n`
            + `  "borderRadius": "Xpx",\n`
            + `  "spacing": { "base": "8px" }\n`
            + `}\n`
            + `\`\`\`\n\n`
            + `Pastikan warna primary memiliki kontras yang baik dengan background dan warna teks. `
            + `Jika style menyebut dark/gelap, sesuaikan background dan surface ke warna gelap.`;
    }
    // ── Step 3 → one HTML page ─────────────────────────────────────────────────
    static step3PagePrompt(pageName, state) {
        const t = state.designToken;
        const fileName = pageName.toLowerCase().replace(/\s+/g, '-');
        const otherPages = state.pages.filter(p => p !== pageName);
        const navLinks = state.pages
            .map(p => `<a href="${p.toLowerCase().replace(/\s+/g, '-')}.html" class="nav-link${p === pageName ? ' active' : ''}">${p}</a>`)
            .join('\n        ');
        return `Buat file \`docs/design/${fileName}.html\` langsung di workspace ini.\n\n`
            + `File ini adalah HTML prototype untuk halaman **"${pageName}"** dari proyek **${state.projectName}**.\n\n`
            + `**Deskripsi sistem:** ${state.systemDescription}\n`
            + `**Halaman lain di sistem ini:** ${otherPages.length > 0 ? otherPages.join(', ') : '(belum ada)'}\n\n`
            + `**Design tokens:**\n`
            + `- Primary color: ${t.primary}\n`
            + `- Border radius: ${t.radius}\n`
            + `- Font family: ${t.font}\n\n`
            + `**Layout wajib:**\n`
            + `- \`<aside class="sidebar">\` — navigasi kiri, lebar 220px\n`
            + `- \`<header class="topbar">\` — header atas, tinggi 56px\n`
            + `- \`<main class="content">\` — area konten utama\n\n`
            + `**Nav links di sidebar:**\n`
            + `        ${navLinks}\n\n`
            + `**CSS wajib:**\n`
            + `- Semua CSS di dalam tag \`<style>\`, tidak ada external stylesheet\n`
            + `- CSS variables dari design tokens di atas\n`
            + `- Class: \`.btn\`, \`.btn-primary\`, \`.btn-outline\`, \`.card\`, \`.badge\`, \`.nav-link\`, \`.nav-link.active\`\n\n`
            + `**Konten \`<main>\`:**\n`
            + `- Realistis dan spesifik untuk fungsi halaman "${pageName}"\n`
            + `- Gunakan data dummy realistis (nama, angka, tanggal) — bukan lorem ipsum\n`
            + `- Tambahkan komentar ini tepat di atas \`<main>\`:\n`
            + `  \`<!-- ArchiGuide: halaman ${pageName} — ${state.projectName} -->\`\n`
            + `  \`<!-- Copilot: implementasikan komponen framework di sini mengacu HTML ini -->\`\n\n`
            + `File harus self-contained dan langsung bisa dibuka di browser.`;
    }
    // ── Step 4 → stack analysis (chat only, no file creation) ─────────────────
    static step4Prompt(state) {
        return `@workspace Berdasarkan dokumen di \`docs/flow.md\` dan \`docs/FSD.md\` untuk proyek **${state.projectName}**,\n\n`
            + `analisa sistem ini dan berikan rekomendasi tech stack terbaik.\n\n`
            + `Pertimbangkan:\n`
            + `- Kompleksitas sistem dan jumlah entitas data\n`
            + `- Kebutuhan real-time atau tidak\n`
            + `- Ukuran tim yang wajar untuk sistem ini\n`
            + `- Apakah BE dan FE sebaiknya menyatu (monolith) atau terpisah\n\n`
            + `Berikan rekomendasi dalam format:\n`
            + `1. **Stack yang disarankan** — sebutkan teknologinya\n`
            + `2. **Alasan** — kenapa cocok untuk sistem ini\n`
            + `3. **Alternatif** — jika ada pilihan lain yang layak dipertimbangkan\n\n`
            + `Jangan generate kode dulu, hanya analisa dan rekomendasi.`;
    }
    // ── Step 5 → copilot-guides + copilot-instructions ────────────────────────
    static step5Prompt(state) {
        const stack = state.selectedStack;
        const pageList = state.pages
            .map(p => `- ${p} → docs/design/${p.toLowerCase().replace(/\s+/g, '-')}.html`)
            .join('\n');
        return `Buat tiga file panduan developer berikut langsung di workspace ini.\n\n`
            + `**Proyek:** ${state.projectName}\n`
            + `**Stack:** ${stack}\n`
            + `**Deskripsi:** ${state.systemDescription}\n`
            + `**Halaman:**\n${pageList}\n`
            + `**Design tokens:** primary ${state.designToken.primary}, radius ${state.designToken.radius}, font ${state.designToken.font}\n\n`
            + `Gunakan Bahasa Indonesia. Isi dengan konten nyata dan actionable — tanpa placeholder.\n\n`
            + `---\n\n`
            + `**File 1: \`docs/copilot-guides/backend-guide.md\`** — panduan prompt siap pakai untuk developer backend\n\n`
            + `Bagian wajib:\n`
            + `- Konteks Proyek — ringkasan proyek dan stack\n`
            + `- Setup Awal — perintah untuk setup project baru dengan ${stack}\n`
            + `- Prompt Siap Pakai — copy-paste prompts untuk: membuat model & migration, controller & route, auth & middleware\n`
            + `- Konvensi Kode — penamaan, struktur folder, konvensi spesifik ${stack}\n\n`
            + `---\n\n`
            + `**File 2: \`docs/copilot-guides/frontend-guide.md\`** — panduan prompt siap pakai untuk developer frontend\n\n`
            + `Bagian wajib:\n`
            + `- Design Tokens — referensi ke \`.archiguide/design-tokens.json\` dan nilai-nilainya\n`
            + `- Halaman yang Perlu Diimplementasi — list halaman di atas dengan link HTML prototype-nya\n`
            + `- Prompt Konversi HTML→Komponen — per halaman: prompt siap pakai untuk konversi HTML ke komponen framework\n`
            + `- Aturan Konsistensi — sidebar, topbar, button, card harus konsisten di semua halaman\n\n`
            + `---\n\n`
            + `**File 3: \`.github/copilot-instructions.md\`** — file instruksi Copilot yang dimuat otomatis di setiap request\n\n`
            + `Buat file ini singkat dan padat (maks 80 baris). Bagian wajib:\n`
            + `- Nama proyek & deskripsi singkat\n`
            + `- Stack teknologi\n`
            + `- Konvensi kode utama\n`
            + `- Lokasi design system (\`.archiguide/design-tokens.json\`, \`docs/design/\`)\n`
            + `- List halaman sistem\n`
            + `- Link ke panduan: \`docs/copilot-guides/backend-guide.md\` dan \`docs/copilot-guides/frontend-guide.md\``;
    }
}
exports.PromptBuilder = PromptBuilder;
//# sourceMappingURL=promptBuilder.js.map