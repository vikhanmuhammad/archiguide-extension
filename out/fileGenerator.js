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
exports.FileGenerator = void 0;
exports.parseFilesFromResponse = parseFilesFromResponse;
const vscode = __importStar(require("vscode"));
/**
 * Parses LM response that uses [[FILE:path]]...[[/FILE]] delimiters.
 * Also handles markdown code blocks as fallback: ```path\n...```
 */
function parseFilesFromResponse(text) {
    const files = [];
    let m;
    // Format 1: [[FILE:path]]...[[/FILE]] — works even if Copilot wraps it in a code block
    const delimRe = /\[\[FILE:(.*?)\]\]([\s\S]*?)\[\[\/FILE\]\]/g;
    while ((m = delimRe.exec(text)) !== null) {
        files.push({ path: m[1].trim(), content: m[2].trim() });
    }
    if (files.length > 0) {
        return files;
    }
    // Format 2: ### FILE: path\n```lang\n...\n``` — Copilot Chat natural output
    const chatFileRe = /###\s*FILE:\s*([^\n]+)\n```[\w]*\n([\s\S]*?)```/g;
    while ((m = chatFileRe.exec(text)) !== null) {
        files.push({ path: m[1].trim(), content: m[2].trim() });
    }
    if (files.length > 0) {
        return files;
    }
    // Format 3: fenced code block with // path comment on first line
    const fenceRe = /```[\w]*\n\/\/ ([^\n]+)\n([\s\S]*?)```/g;
    while ((m = fenceRe.exec(text)) !== null) {
        files.push({ path: m[1].trim(), content: m[2].trim() });
    }
    return files;
}
class FileGenerator {
    /**
     * Call the LM API, stream the response, and return the full text.
     * Throws if no model is available.
     */
    static async callLM(prompt, onProgress, token) {
        onProgress('Menghubungi AI model...');
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (!models.length) {
            throw new Error('Tidak ada AI model tersedia. Pastikan GitHub Copilot terinstall, aktif, dan Anda sudah login.');
        }
        const model = models[0];
        const cts = new vscode.CancellationTokenSource();
        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        onProgress(`Generating dengan ${model.name}...`);
        const response = await model.sendRequest(messages, {}, token ?? cts.token);
        let text = '';
        for await (const fragment of response.text) {
            text += fragment;
        }
        return text;
    }
    /**
     * Call LM, parse the delimited file response, write each file to workspace.
     */
    static async generateAndWrite(prompt, workspaceUri, onProgress, token) {
        const responseText = await FileGenerator.callLM(prompt, onProgress, token);
        const files = parseFilesFromResponse(responseText);
        if (files.length === 0) {
            throw new Error('AI tidak menghasilkan file dalam format yang diharapkan. Coba kirim ulang prompt.');
        }
        for (const file of files) {
            onProgress(`Menulis ${file.path}...`);
            const uri = vscode.Uri.joinPath(workspaceUri, file.path);
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
            await vscode.workspace.fs.writeFile(uri, Buffer.from(file.content, 'utf8'));
        }
        return files;
    }
    /** Write a single file directly (no LM call). */
    static async writeDirect(relativePath, content, workspaceUri, onProgress) {
        onProgress(`Menulis ${relativePath}...`);
        const uri = vscode.Uri.joinPath(workspaceUri, relativePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    }
}
exports.FileGenerator = FileGenerator;
//# sourceMappingURL=fileGenerator.js.map