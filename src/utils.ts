/* --------------------
 * Copyright(C) Matthias Behr, 2024.
 */

import * as vscode from 'vscode';
import { fileExists } from './websharkView';

export function fileExistsOrPick(settingsName: string, binaryName: string): Promise<string> {
  const filePath = <string>vscode.workspace.getConfiguration().get(settingsName);
  return new Promise((resolve, reject) => {
    if (fileExists(filePath)) {
      resolve(filePath);
    } else {
      vscode.window
        .showErrorMessage(
          `'${settingsName}' setting not pointing to a file. Please change setting or use file picker. Currently used: '${filePath}'`,
          { modal: true },
          'use file picker...',
          'open settings'
        )
        .then((value) => {
          switch (value) {
            case 'open settings':
              vscode.commands.executeCommand('workbench.action.openSettings', settingsName);
              reject(`file '${filePath}' does not exist`);
              return;
            case 'use file picker...':
              vscode.window
                .showOpenDialog({
                  canSelectFiles: true,
                  canSelectFolders: false,
                  canSelectMany: false,
                  openLabel: `Select ${settingsName}`,
                })
                .then((uris) => {
                  if (uris && uris.length > 0) {
                    // special handling for Mac. If the user selected a folder
                    // that ends in .app
                    // check whether
                    // Contents/MacOS/<binarynam> exists and use that instead
                    if (uris[0].fsPath.endsWith('.app')) {
                      const macPath = `${uris[0].fsPath}/Contents/MacOS/${binaryName}`;
                      if (fileExists(macPath)) {
                        vscode.workspace.getConfiguration().update(settingsName, macPath, vscode.ConfigurationTarget.Global);
                        resolve(macPath);
                        return;
                      }
                    }
                    vscode.workspace.getConfiguration().update(settingsName, uris[0].fsPath, vscode.ConfigurationTarget.Global);
                    resolve(uris[0].fsPath);
                    return;
                  } else {
                    reject(`no file selected. file '${filePath}' does not exist`);
                  }
                });
              return;
          }
        });
    }
  });
}
