import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { SidebarProvider } from './sidebarProvider';

export async function activate(context: vscode.ExtensionContext) {
  const state = new StateManager(context);
  await state.initFromWorkspace();

  const provider = new SidebarProvider(context, state);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('archiguide.sidebar', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('archiguide.newProject', async () => {
      vscode.commands.executeCommand('workbench.view.extension.archiguide');
    })
  );
}

export function deactivate() {}
