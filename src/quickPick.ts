/* --------------------
 * Copyright(C) Matthias Behr, 2020.
 */

import * as vscode from 'vscode';

export class PickItem implements vscode.QuickPickItem {
    name: string; // like label but icon will be added in front
    icon: string | undefined;
    description: string | undefined;
    detail: string | undefined;
    data: any;

    constructor() { this.name = '<noname>'; }
    get label() {
        if (this.icon) {
            return `${this.icon} ${this.name}`;
        } else {
            return this.name;
        }
    }

    get alwaysShow() { return true; }
};

export class QuickInputHelper {

    static createQuickPick<T extends vscode.QuickPickItem>(title: string, step: number | undefined, totalSteps: number | undefined): vscode.QuickPick<T> {
        const quickPick = vscode.window.createQuickPick<T>();
        quickPick.title = title;
        quickPick.ignoreFocusOut = true; // todo add cancel button?
        quickPick.canSelectMany = true;
        quickPick.matchOnDescription = true;
        quickPick.step = step;
        quickPick.totalSteps = totalSteps;

        if (step !== undefined && step > 1) {
            // add back button:
            quickPick.buttons = [vscode.QuickInputButtons.Back];
        }

        return quickPick;
    }

    static async show<T extends vscode.QuickPickItem>(quickPick: vscode.QuickPick<T>) {
        const disposables: vscode.Disposable[] = [];
        try {

            return await new Promise<readonly T[] | string>((resolve, reject) => {
                disposables.push(quickPick.onDidAccept(() => {
                    quickPick.busy = true;
                    console.log(`show onDidAccept() got selectedItems.length=${quickPick.selectedItems.length} and value='${quickPick.value}'`);
                    quickPick.enabled = false; // no hide here. done by dispose
                    resolve(quickPick.selectedItems.length ? quickPick.selectedItems : quickPick.value);
                }));
                // todo add support for validation of entered filter text

                disposables.push(quickPick.onDidTriggerButton(button => {
                    if (button === vscode.QuickInputButtons.Back) {
                        reject(vscode.QuickInputButtons.Back);
                    }
                }));

                disposables.push(quickPick.onDidHide(() => {
                    console.log(`show onDidHide()...`);
                    reject();
                }));

                quickPick.show();
            });

        } finally {
            disposables.forEach(d => d.dispose());
        }
    }
}
