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
        const en = state.language === 'en';
        const refSection = state.referenceFiles?.length
            ? (en
                ? `\n\nReference documents are available in the workspace — read them as additional specification sources:\n`
                : `\n\nDokumen referensi tersedia di workspace — baca sebagai sumber spesifikasi tambahan:\n`)
                + state.referenceFiles.map(f => `#file:${f}`).join('\n')
            : '';
        if (en) {
            return `Create the following two markdown files directly in this workspace for project **${state.projectName}**.\n\n`
                + `**System description:**\n${state.systemDescription}`
                + refSection + `\n\n`
                + `Use English. Fill with real, specific content — no placeholders.\n\n`
                + `---\n\n`
                + `**File 1: \`docs/FSD.md\`** — Functional Specification Document (for non-technical stakeholders)\n\n`
                + `Required sections:\n`
                + `- **System Overview** — rewrite the description in plain language\n`
                + `- **Who Uses It** — list every user role with a description\n`
                + `- **Key Features** — at least 5 features in non-technical language\n`
                + `- **Usage Flows** — narrative flow per role, step by step\n`
                + `- **System Boundaries** — what is NOT covered by this system\n\n`
                + `---\n\n`
                + `**File 2: \`docs/flow.md\`** — Technical Flow Document (for developers)\n\n`
                + `Required sections:\n`
                + `- **System Architecture** — main components: frontend, backend, database, external services\n`
                + `- **Core Data Entities** — each entity/table with fields and data types\n`
                + `- **Roles & Permissions** — each role with specific permissions\n`
                + `- **Technical Flow Per Feature** — per feature: Input → Process → Output\n`
                + `- **Required Pages** — MUST write with EXACTLY this format (heading and bullet list):\n\n`
                + `## Halaman yang Dibutuhkan\n`
                + `- PageName1\n`
                + `- PageName2\n`
                + `- PageName3\n`
                + `- etc...\n\n`
                + `Each line contains only the page name (1–3 words, no description on the same line). Minimum 5 pages.`;
        }
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
        const en = state.language === 'en';
        const style = state.styleDescription?.trim()
            || (en ? 'professional modern look, blue color, Inter font' : 'tampilan profesional dan modern, warna biru, font Inter');
        const jsonTemplate = `\`\`\`json\n`
            + `{\n`
            + `  "theme": "${en ? 'short-theme-name' : 'nama-tema-singkat'}",\n`
            + `  "colors": {\n`
            + `    "primary": "#hex",\n`
            + `    "background": "#hex",\n`
            + `    "surface": "#hex",\n`
            + `    "text": "#hex",\n`
            + `    "textMuted": "#hex",\n`
            + `    "border": "#hex"\n`
            + `  },\n`
            + `  "typography": {\n`
            + `    "fontFamily": "${en ? 'font name, fallback sans-serif' : 'nama font, fallback sans-serif'}",\n`
            + `    "baseSize": "16px"\n`
            + `  },\n`
            + `  "borderRadius": "Xpx",\n`
            + `  "spacing": { "base": "8px" }\n`
            + `}\n`
            + `\`\`\``;
        if (en) {
            return `Create the file \`.archiguide/design-tokens.json\` directly in this workspace.\n\n`
                + `**Project:** ${state.projectName}\n`
                + `**Desired style:** ${style}\n\n`
                + `Create a JSON file with EXACTLY this structure — fill values based on the style description above:\n\n`
                + jsonTemplate + `\n\n`
                + `Ensure the primary color has good contrast with the background and text colors. `
                + `If the style mentions dark mode, adjust background and surface to dark colors.`;
        }
        return `Buat file \`.archiguide/design-tokens.json\` langsung di workspace ini.\n\n`
            + `**Proyek:** ${state.projectName}\n`
            + `**Style yang diinginkan:** ${style}\n\n`
            + `Buat file JSON dengan struktur PERSIS seperti ini — isi nilainya berdasarkan deskripsi style di atas:\n\n`
            + jsonTemplate + `\n\n`
            + `Pastikan warna primary memiliki kontras yang baik dengan background dan warna teks. `
            + `Jika style menyebut dark/gelap, sesuaikan background dan surface ke warna gelap.`;
    }
    // ── Step 3 → one HTML page ─────────────────────────────────────────────────
    static step3PagePrompt(pageName, state) {
        const en = state.language === 'en';
        const dt = state.designToken;
        const fileName = pageName.toLowerCase().replace(/\s+/g, '-');
        const otherPages = state.pages.filter(p => p !== pageName);
        const navLinks = state.pages
            .map(p => `<a href="${p.toLowerCase().replace(/\s+/g, '-')}.html" class="nav-link${p === pageName ? ' active' : ''}">${p}</a>`)
            .join('\n        ');
        if (en) {
            return `Create the file \`docs/design/${fileName}.html\` directly in this workspace.\n\n`
                + `This is an HTML prototype for the **"${pageName}"** page of project **${state.projectName}**.\n\n`
                + `**System description:** ${state.systemDescription}\n`
                + `**Other pages in this system:** ${otherPages.length > 0 ? otherPages.join(', ') : '(none yet)'}\n\n`
                + `**Design tokens:**\n`
                + `- Primary color: ${dt.primary}\n`
                + `- Border radius: ${dt.radius}\n`
                + `- Font family: ${dt.font}\n\n`
                + `**Required layout:**\n`
                + `- \`<aside class="sidebar">\` — left navigation, 220px wide\n`
                + `- \`<header class="topbar">\` — top header, 56px tall\n`
                + `- \`<main class="content">\` — main content area\n\n`
                + `**Sidebar nav links:**\n`
                + `        ${navLinks}\n\n`
                + `**Required CSS:**\n`
                + `- All CSS inside \`<style>\` tag, no external stylesheet\n`
                + `- CSS variables from the design tokens above\n`
                + `- Classes: \`.btn\`, \`.btn-primary\`, \`.btn-outline\`, \`.card\`, \`.badge\`, \`.nav-link\`, \`.nav-link.active\`\n\n`
                + `**\`<main>\` content:**\n`
                + `- Realistic and specific to the "${pageName}" page's function\n`
                + `- Use realistic dummy data (names, numbers, dates) — no lorem ipsum\n`
                + `- Add these comments right above \`<main>\`:\n`
                + `  \`<!-- ArchiGuide: page ${pageName} — ${state.projectName} -->\`\n`
                + `  \`<!-- Copilot: implement framework components here referencing this HTML -->\`\n\n`
                + `File must be self-contained and openable directly in a browser.`;
        }
        return `Buat file \`docs/design/${fileName}.html\` langsung di workspace ini.\n\n`
            + `File ini adalah HTML prototype untuk halaman **"${pageName}"** dari proyek **${state.projectName}**.\n\n`
            + `**Deskripsi sistem:** ${state.systemDescription}\n`
            + `**Halaman lain di sistem ini:** ${otherPages.length > 0 ? otherPages.join(', ') : '(belum ada)'}\n\n`
            + `**Design tokens:**\n`
            + `- Primary color: ${dt.primary}\n`
            + `- Border radius: ${dt.radius}\n`
            + `- Font family: ${dt.font}\n\n`
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
        const en = state.language === 'en';
        if (en) {
            return `@workspace Based on the documents in \`docs/flow.md\` and \`docs/FSD.md\` for project **${state.projectName}**,\n\n`
                + `analyze this system and provide the best tech stack recommendation.\n\n`
                + `Consider:\n`
                + `- System complexity and number of data entities\n`
                + `- Real-time requirements or not\n`
                + `- Reasonable team size for this system\n`
                + `- Whether BE and FE should be unified (monolith) or separated\n\n`
                + `Provide recommendation in this format:\n`
                + `1. **Recommended stack** — name the technologies\n`
                + `2. **Reasoning** — why it fits this system\n`
                + `3. **Alternatives** — if there are other options worth considering\n\n`
                + `Do not generate code yet, just analysis and recommendation.`;
        }
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
        const en = state.language === 'en';
        const stack = state.selectedStack;
        const pageList = state.pages
            .map(p => `- ${p} → docs/design/${p.toLowerCase().replace(/\s+/g, '-')}.html`)
            .join('\n');
        if (en) {
            return `Create the following three developer guide files directly in this workspace.\n\n`
                + `**Project:** ${state.projectName}\n`
                + `**Stack:** ${stack}\n`
                + `**Description:** ${state.systemDescription}\n`
                + `**Pages:**\n${pageList}\n`
                + `**Design tokens:** primary ${state.designToken.primary}, radius ${state.designToken.radius}, font ${state.designToken.font}\n\n`
                + `Use English. Fill with real, actionable content — no placeholders.\n\n`
                + `---\n\n`
                + `**File 1: \`docs/copilot-guides/backend-guide.md\`** — ready-to-use prompt guide for backend developers\n\n`
                + `Required sections:\n`
                + `- Project Context — project and stack summary\n`
                + `- Initial Setup — commands to set up a new project with ${stack}\n`
                + `- Ready-to-use Prompts — copy-paste prompts for: creating models & migrations, controllers & routes, auth & middleware\n`
                + `- Code Conventions — naming, folder structure, ${stack}-specific conventions\n\n`
                + `---\n\n`
                + `**File 2: \`docs/copilot-guides/frontend-guide.md\`** — ready-to-use prompt guide for frontend developers\n\n`
                + `Required sections:\n`
                + `- Design Tokens — reference to \`.archiguide/design-tokens.json\` and its values\n`
                + `- Pages to Implement — list of pages above with links to their HTML prototypes\n`
                + `- HTML→Component Conversion Prompts — per page: ready-to-use prompt to convert HTML to framework component\n`
                + `- Consistency Rules — sidebar, topbar, button, card must be consistent across all pages\n\n`
                + `---\n\n`
                + `**File 3: \`.github/copilot-instructions.md\`** — Copilot instruction file auto-loaded on every request\n\n`
                + `Keep this file concise (max 80 lines). Required sections:\n`
                + `- Project name & brief description\n`
                + `- Tech stack\n`
                + `- Main code conventions\n`
                + `- Design system location (\`.archiguide/design-tokens.json\`, \`docs/design/\`)\n`
                + `- System pages list\n`
                + `- Links to guides: \`docs/copilot-guides/backend-guide.md\` and \`docs/copilot-guides/frontend-guide.md\``;
        }
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
    // ── Step 6 → scaffold actual project code ─────────────────────────────────
    static step6Prompt(state) {
        const en = state.language === 'en';
        const safeName = state.projectName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        const pageList = state.pages
            .map(p => `- ${p} → docs/design/${p.toLowerCase().replace(/\s+/g, '-')}.html`)
            .join('\n');
        if (en) {
            return `Scaffold project **${state.projectName}** using stack **${state.selectedStack}** `
                + `inside the \`project/\` folder that already exists in this workspace.\n\n`
                + `**Project folder name:** \`${safeName}\`\n`
                + `**System description:** ${state.systemDescription}\n\n`
                + `**Steps to perform:**\n\n`
                + `1. Run the ${state.selectedStack} scaffold command inside the \`project/\` folder\n`
                + `2. Create the folder structure and initial files following ${state.selectedStack} conventions\n`
                + `3. Set the project name to \`${safeName}\` in the config file (package.json, composer.json, pyproject.toml, etc.)\n`
                + `4. Create an \`.env.example\` file with required environment variables (database, app key, etc.)\n`
                + `5. Read the backend guide for specific initial setup:\n`
                + `   #file:docs/copilot-guides/backend-guide.md\n\n`
                + `**Pages to implement (HTML prototypes exist):**\n${pageList}\n\n`
                + `**Additional references:**\n`
                + `#file:docs/copilot-guides/frontend-guide.md\n`
                + `#file:docs/copilot-guides/backend-guide.md\n`
                + `#file:.github/copilot-instructions.md\n`
                + `#file:docs/flow.md\n\n`
                + `After scaffolding is complete, display a summary: commands run, folder structure created, and next steps for developers.`;
        }
        return `Scaffold proyek **${state.projectName}** menggunakan stack **${state.selectedStack}** `
            + `di dalam folder \`project/\` yang sudah ada di workspace ini.\n\n`
            + `**Nama folder project:** \`${safeName}\`\n`
            + `**Deskripsi sistem:** ${state.systemDescription}\n\n`
            + `**Langkah yang perlu dilakukan:**\n\n`
            + `1. Jalankan perintah scaffold ${state.selectedStack} di dalam folder \`project/\`\n`
            + `2. Buat struktur folder dan file awal sesuai konvensi ${state.selectedStack}\n`
            + `3. Set nama project sebagai \`${safeName}\` di file konfigurasi (package.json, composer.json, pyproject.toml, dll.)\n`
            + `4. Buat file \`.env.example\` dengan variabel environment yang dibutuhkan (database, app key, dll.)\n`
            + `5. Baca panduan backend untuk setup awal yang spesifik:\n`
            + `   #file:docs/copilot-guides/backend-guide.md\n\n`
            + `**Halaman yang perlu diimplementasi (ada prototype HTML-nya):**\n${pageList}\n\n`
            + `**Referensi tambahan:**\n`
            + `#file:docs/copilot-guides/frontend-guide.md\n`
            + `#file:docs/copilot-guides/backend-guide.md\n`
            + `#file:.github/copilot-instructions.md\n`
            + `#file:docs/flow.md\n\n`
            + `Setelah scaffold selesai, tampilkan ringkasan: perintah yang dijalankan, struktur folder yang dibuat, dan langkah selanjutnya untuk developer.`;
    }
}
exports.PromptBuilder = PromptBuilder;
//# sourceMappingURL=promptBuilder.js.map