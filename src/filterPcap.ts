/* --------------------
 * Copyright(C) Matthias Behr, 2020 - 2021.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as tshark from './tshark';
import { QuickInputHelper, PickItem } from './quickPick';
import * as path from 'path';

const platformWin32: boolean = process.platform === "win32";
const separator = platformWin32 ? '"' : "'"; // win cmd uses ", unix sh uses '

export async function filterPcap(uris: readonly vscode.Uri[]) {

    const confSteps = vscode.workspace.getConfiguration().get<Array<any>>('vsc-webshark.filterSteps');

    console.log(`filterPcap(${uris.map(v => v.toString()).join(',')}) with ${confSteps?.length} steps...`);

    if (confSteps === undefined || confSteps.length === 0) {
        vscode.window.showErrorMessage('please check your vsc-webshark.filterSteps configuration! None defined.', { modal: true });
        return;
    }

    const steps: object[] = [...confSteps];

    const execFunction = function (steps: readonly object[], saveUri: vscode.Uri) {
        let tsharkArgs: string[][] = getTSharkArgs(steps);
        if (tsharkArgs.length) {
            vscode.window.withProgress(
                { cancellable: true, location: vscode.ProgressLocation.Notification, title: `filtering file to ${saveUri.toString()}` },
                async (progress, cancelToken) => {
                    // run tshark:
                    let receivedData: Buffer[] = [];
                    const tp = new tshark.TSharkProcess(tsharkArgs,
                        (data: Buffer) => {
                            receivedData.push(data);
                        }, uris.map(v => v.fsPath), saveUri.fsPath);
                    let wasCancelled = false;
                    cancelToken.onCancellationRequested(() => {
                        console.log(`filtering cancelled.`);
                        wasCancelled = true;
                        tp.dispose();
                    });
                    progress.report({ message: `Applying ${tsharkArgs.length} filter...` });
                    let interval = setInterval(() => {
                        var stats = fs.statSync(saveUri.fsPath);
                        const fileSize = stats["size"] / (1000 * 1000);
                        progress.report({ message: `Applying ${tsharkArgs.length} filter... generated ${Math.round(fileSize)}MB` });
                    }, 1000); // todo could add number of seconds running as well
                    await tp.done().then((res: number) => {
                        if (res === 0) {
                            vscode.window.showInformationMessage(`successfully filtered file '${saveUri.toString()}'`);
                            const receivedStrs = receivedData.join('').split('\n');
                            console.log(`done receivedStrs=${receivedStrs.length}`);
                            for (let i = 0; i < receivedStrs.length; ++i) {
                                const line = receivedStrs[i];
                                console.log(line);
                            }
                        } else {
                            if (!wasCancelled) {
                                vscode.window.showErrorMessage(`filtering file failed with res=${res}`, { modal: true });
                            }
                        }
                    }).catch((err) => {
                        console.log(`got err:${err}`);
                        vscode.window.showErrorMessage(`filtering file failed with err=${err}`, { modal: true });
                    });
                    clearInterval(interval);
                }
            );
        }
    };

    return execFilterPcap(uris, '_filtered.pcap', steps, execFunction);

}


export async function extractDlt(uris: readonly vscode.Uri[]) {
    const confSteps = vscode.workspace.getConfiguration().get<Array<any>>('vsc-webshark.extractDltSteps');
    const extractArgs = vscode.workspace.getConfiguration().get<Array<string>>('vsc-webshark.extractDltArgs');

    console.log(`extractDlt(${uris.map(v => v.toString()).join(',')}) with ${confSteps?.length} steps...`);

    if (confSteps === undefined || confSteps.length === 0) {
        vscode.window.showErrorMessage('please check your vsc-webshark.exportDltSteps configuration! None defined.', { modal: true });
        return;
    }
    if (extractArgs === undefined || extractArgs.length === 0) {
        vscode.window.showErrorMessage('please check your vsc-webshark.exportDltArgs configuration! None defined.', { modal: true });
        return;
    }

    const steps: object[] = [...confSteps];

    return execFilterPcap(uris, '_extracted.dlt', steps, (steps: readonly object[], saveUri: vscode.Uri) => {
        let tsharkArgs: string[][] = getTSharkArgs(steps);
        // we add the specific args here:
        tsharkArgs.push(extractArgs);
        if (tsharkArgs.length) {
            vscode.window.withProgress(
                { cancellable: true, location: vscode.ProgressLocation.Notification, title: `extracting DLT to ${saveUri.toString()}` },
                async (progress, cancelToken) => {
                    let nrMsgs = 0;
                    // create the file:
                    let saveFile = fs.openSync(saveUri.fsPath, 'w'); 

                    // run tshark:
                    const tp = new tshark.TSharkDataProvider(tsharkArgs, uris.map(v => v.fsPath));
                    const bufStorageHeader = Buffer.alloc(16);
                    bufStorageHeader.writeUInt32LE(0x01544c44, 0); // DLT+0x01 (0x44 0x4c 0x54 0x01)
                    bufStorageHeader.write('pcap', 12, 4, "ascii"); // ECU ID four chars (we hardcode to pcap)

                    tp.onDidChangeData((lines: readonly string[]) => {
                        //console.log(`onDidChangeData(lines.length=${lines.length}`);
                        for (let i = 0; i < lines.length; ++i) {
                            const line = lines[i].split('\t');
                            const [strSeconds, strMicros] = line[0].split('.');
                            const seconds = Number(strSeconds);
                            const micros = Number(strMicros.slice(0, 6).padEnd(6, '0'));
                            const bufPayload = Buffer.from(line[1], "hex");
                            // Timestamp: uint32 seconds sint32 micros
                            bufStorageHeader.writeUInt32LE(seconds, 4);
                            bufStorageHeader.writeInt32LE(micros, 8);
                            fs.writeFileSync(saveFile, bufStorageHeader);
                            fs.writeFileSync(saveFile, bufPayload);
                            nrMsgs++;
                        }
                    });

                    let wasCancelled = false;
                    cancelToken.onCancellationRequested(() => {
                        console.log(`extracting cancelled.`);
                        wasCancelled = true;
                        tp.dispose();
                        fs.closeSync(saveFile);
                        saveFile = -1;
                    });
                    progress.report({ message: `Extracting DLT...` });
                    let interval = setInterval(() => {
                        var stats = fs.statSync(saveUri.fsPath);
                        const fileSize = stats["size"] / (1000 * 1000);
                        progress.report({ message: `Extracting DLT generated ${nrMsgs} msgs and ${Math.round(fileSize)}MB` });
                    }, 1000); // todo could add number of seconds running as well
                    await tp.done().then((res: number) => {
                        fs.closeSync(saveFile);
                        saveFile = -1;
                        vscode.window.showInformationMessage(`successfully extracted ${nrMsgs} DLT msgs to file '${saveUri.toString()}'`);
                    }).catch((err) => {
                        fs.closeSync(saveFile);
                        saveFile = -1;
                        console.log(`got err:${err}`);
                        vscode.window.showErrorMessage(`extracting DLT failed with err=${err}`, { modal: true });
                    });
                    clearInterval(interval);
                }
            );
        }
    });
}

function getFilterExpr(stepData: any, items: readonly PickItem[] | string): string {
    // return a tshark filter expression to be used with -Y ...
    let filter: string = '';

    if (Array.isArray(items)) {
        for (let i = 0; i < items.length; ++i) {
            const item = items[i];
            console.log(` getFilterExpr item=${JSON.stringify(item)}`);
            if (item.data.key.length === 0) { continue; }// skip
            if (filter.length > 0) {
                filter += ' or ';
            }
            if (item.data.data?.filterField !== undefined) {
                filter += item.data.data.filterField;
            } else {
                filter += stepData.filterField;
            }
            filter += `${stepData.filterOp ? stepData.filterOp : '=='}${item.data.key}`;
        }

        if (stepData.filterNegate !== undefined && stepData.filterNegate && filter.length > 0) {
            filter = `!(${filter})`;
        }
    } else {
        filter = <string>items;
    }

    return filter;
};

function getTSharkArgs(steps: readonly any[]): string[][] {
    let tsharkArgs: string[][] = [];
    for (let s = 0; s < steps.length; ++s) {
        const stepData: any = steps[s];
        const filterExpr = getFilterExpr(stepData, stepData.results);
        let stepArgs: string[] = stepData.filterArgs ? [...stepData.filterArgs] : [];
        if (filterExpr.length) {
            stepArgs.push(`-Y ${separator}${filterExpr}${separator}`);
        }
        console.log(`got filter from step ${s}: '${filterExpr}'`);
        console.log(`got tsharkArgs from step ${s}: '${stepArgs.join(' ')}'`);
        if (stepArgs.length) { tsharkArgs.push(stepArgs); }
    }
    return tsharkArgs;
};


async function execFilterPcap(uris: readonly vscode.Uri[], saveFileExt: string, steps: readonly object[], execFunction: (steps: readonly object[], saveUri: vscode.Uri) => void, noSteps = false) {

    console.log(`execFilterPcap(${uris.map(v => v.toString()).join(',')}) with ${steps?.length} steps...`);

    // clear any prev. results:
    for (let s = 0; s < steps.length; ++s) {
        const step: any = steps[s];
        step.listProviderFinished = undefined;
        step.listProviderData = undefined;
        step.results = undefined;
    }

    const updatePickItem = function (item: PickItem, data: any, key: string, listDescription: string[] | undefined): void {
        item.name = key;
        if (data.icon) {
            item.icon = data.icon;
        }
        item.data = { key: key, data: data };
        let descString: string = '';
        if (listDescription) {
            for (let i = 0; i < listDescription.length; ++i) {
                descString += data[listDescription[i]];
            }
        }
        item.description = descString;
    };

    const updateQuickPick = function (stepData: any, data: tshark.ListData, items: PickItem[], quickPick: vscode.QuickPick<PickItem>, selectedItems: PickItem[] | undefined = undefined): void {
        stepData.listProviderData = data; // store in case we'd like to go back
        //console.log(`got ListData map.size=${data.map.size}`);
        data.map.forEach((value, mapKey) => {
            const key = value._firstKey || mapKey;
            const oldItemIdx = items.findIndex((value) => {
                if (value?.data?.key === key) { return true; }
                return false;
            });
            if (oldItemIdx !== -1) {
                updatePickItem(items[oldItemIdx], value, key, stepData.listDescription);
            } else {
                console.log(`got new ListData: key='${key}', data='${JSON.stringify(value)}'`);
                const newItem = new PickItem();
                if (stepData.listIcon) { value.icon = stepData.listIcon; }
                updatePickItem(newItem, value, key, stepData.listDescription);
                items.push(newItem);
            }
        });
        // as we can only overwrite the full set we need to mark the selected ones:
        const newSelItems: PickItem[] = [];
        const selectedItemsToUse = selectedItems ? selectedItems : quickPick.selectedItems;
        selectedItemsToUse.forEach((selItem) => {
            const itemIdx = items.findIndex((newVal) => {
                if (newVal?.data?.key === selItem?.data?.key) { return true; }
                return false;
            });
            if (itemIdx !== -1) {
                newSelItems.push(items[itemIdx]);
            }
        });
        quickPick.items = items;
        quickPick.selectedItems = newSelItems;
    };

    for (let s = 0; s < steps.length; ++s) {
        const stepData: any = steps[s];
        const items: PickItem[] = [];

        if (stepData.staticItems) {
            for (let i = 0; i < stepData.staticItems.length; ++i) {
                const staticData = stepData.staticItems[i];
                const staticItem = new PickItem();
                updatePickItem(staticItem, staticData, staticData.key, stepData.listDescription);
                items.push(staticItem);
            }
        }

        // create quickpick but don't show yet:
        const quickPick = QuickInputHelper.createQuickPick<PickItem>('filter pcap...', s + 1, steps.length + 1); // last step is save...
        quickPick.placeholder = stepData.title;
        quickPick.items = items;
        quickPick.selectedItems = items; // the static items are pre-selected

        if (stepData.listProviderData !== undefined) {
            // we got some data already:
            updateQuickPick(stepData, stepData.listProviderData, items, quickPick, stepData.results);
        }

        // do a search in the background?
        let tsharkLP: tshark.TSharkListProvider | undefined = undefined;
        if (stepData["listProvider"] && !stepData.listProviderFinished) {
            // add the tsharkArgs from previous steps:
            let tsharkArgs = getTSharkArgs(steps.slice(0, s));
            tsharkArgs = tsharkArgs.concat(stepData.listProvider);
            tsharkLP = new tshark.TSharkListProvider(tsharkArgs, stepData.listProviderOptions || null, uris.map(u => u.fsPath));
            quickPick.busy = true;

            tsharkLP.onDidChangeData((data: tshark.ListData) => {
                updateQuickPick(stepData, data, items, quickPick);
            });
            tsharkLP.done().then(value => {
                console.log(`tsharkLP.done(value=${value})`);
                quickPick.busy = false;
                if (value === 0) {
                    stepData.listProviderFinished = true;
                }
            });
        }

        let doCancel = false;
        let doBack = false;
        await QuickInputHelper.show(quickPick).then((selectedItems) => {
            console.log(`got selectedItems.length=${selectedItems?.length}`);
            // if the results lead to a changed filterExpr we have to invalidate the listProvider for next steps (if any):
            if (stepData.results !== undefined) {
                // do we have another step with listProviderFinished?
                if (s + 1 < steps.length) {
                    const nextStepData: any = steps[s + 1];
                    if (nextStepData.listProviderFinished !== undefined && nextStepData.listProviderFinished) {
                        // are the filterExpr different?
                        const oldFilterExpr = getFilterExpr(stepData, stepData.results);
                        const newFilterExpr = getFilterExpr(stepData, selectedItems);
                        if (oldFilterExpr !== newFilterExpr) {
                            console.log(`invalidated next steps listProvider`);
                            nextStepData.listProviderFinished = undefined;
                        }
                    }
                }
            }
            stepData.results = selectedItems;
        }).catch(err => {
            if (err === vscode.QuickInputButtons.Back) {
                doBack = true;
            } else {
                console.log(`step loop got err:${err}`);
                doCancel = true;
            }
        });
        console.log(`step ${s} done. `);

        if (tsharkLP !== undefined) {
            tsharkLP.dispose();
        }
        quickPick.dispose();

        if (doCancel) { break; }
        if (doBack) {
            s -= 2;
        }
    }

    // steps done. now save (if last step has results)
    if (steps.length > 0 || noSteps) {
        const lastStep: any = noSteps ? { results: true } : steps[steps.length - 1];
        if (lastStep.results !== undefined) {
            let doRetry;
            do {
                doRetry = false;
                await vscode.window.showSaveDialog({ defaultUri: uris[0].with({ path: uris[0].path + saveFileExt }), saveLabel: 'save filtered pcap as ...' }).then(async saveUri => {
                    if (saveUri) {
                        console.log(`save as uri=${saveUri?.toString()}`);
                        if (uris.map(u => u.toString()).includes(saveUri.toString())) {
                            vscode.window.showErrorMessage('Filtering into same file not possible. Please choose a different one.', { modal: true });
                            doRetry = true;
                        } else {
                            execFunction(steps, saveUri);
                        }
                    }
                });
            } while (doRetry);
        }
    }
    console.log(`filterPcap() done`);
}

export async function removeTecmp(uris: readonly vscode.Uri[]) {
    const confSteps = vscode.workspace.getConfiguration().get<Array<any>>('vsc-webshark.removeTecmpSteps');
    const extractArgs = vscode.workspace.getConfiguration().get<Array<string>>('vsc-webshark.removeTecmpArgs');

    const extension = vscode.extensions.getExtension('mbehr1.vsc-webshark');

    console.log(`removeTecmp(${uris.map(v => v.toString()).join(',')}) with ${confSteps?.length} steps... ext path=${extension?.extensionPath}`);

    if (confSteps === undefined || confSteps.length < 0) {
        vscode.window.showErrorMessage('please check your vsc-webshark.removeTecmpSteps configuration! None defined.', { modal: true });
        return;
    }
    if (extractArgs === undefined || extractArgs.length === 0) {
        vscode.window.showErrorMessage('please check your vsc-webshark.removeTecmpArgs configuration! None defined.', { modal: true });
        return;
    }

    // check whether extractArgs contain:
    // ${{media/tecmpraw.lua}}"  and replace with path to media/tecmpraw.lua
    for (let i = 0; i < extractArgs.length; ++i) {
        let arg = extractArgs[i];
        arg = arg.replace(/\$\{\{(.*?)\}\}/g, (sub, p) => {
            return path.join(extension ? extension.extensionPath : '.', p);
        });
        if (arg !== extractArgs[i]) {
            console.log(` replaced '${extractArgs[i]}' with '${arg}'`);
            extractArgs[i] = arg;
        }
    }

    const steps: object[] = [...confSteps];

    return execFilterPcap(uris, '_woTecmp.pcap', steps, (steps: readonly object[], saveUri: vscode.Uri) => {
        let tsharkArgs: string[][] = getTSharkArgs(steps);
        // we add the specific args here:
        tsharkArgs.push(extractArgs);
        if (tsharkArgs.length) {
            vscode.window.withProgress(
                { cancellable: true, location: vscode.ProgressLocation.Notification, title: `removing TECMP to ${saveUri.toString()}` },
                async (progress, cancelToken) => {
                    let nrMsgs = 0;
                    // create the file:
                    let saveFile = fs.openSync(saveUri.fsPath, 'w'); // todo rmove for exportDlt???,  fs.createWriteStream(saveUri.fsPath, { encoding: "binary" });

                    // run tshark:
                    const tp = new tshark.TSharkDataProvider(tsharkArgs, uris.map(v => v.fsPath));

                    // global pcap header:
                    /* typedef struct pcap_hdr_s {
                        guint32 magic_number;    magic number
                        guint16 version_major;   major version number
                        guint16 version_minor;   minor version number
                        gint32  thiszone;        GMT to local correction
                        guint32 sigfigs;         accuracy of timestamps
                        guint32 snaplen;         max length of captured packets, in octets
                        guint32 network;         data link type
                        } pcap_hdr_t; */

                    const globalHeader = Buffer.allocUnsafe(6 * 4);
                    globalHeader.writeUInt32LE(0xa1b2c3d4, 0); // microsec header
                    globalHeader.writeUInt16LE(0x2, 4);
                    globalHeader.writeUInt16LE(0x4, 6);
                    globalHeader.writeUInt32LE(0x0, 8);
                    globalHeader.writeUInt32LE(0x0, 12);
                    globalHeader.writeUInt32LE(65535, 16);
                    globalHeader.writeUInt32LE(0x1, 20);
                    fs.writeSync(saveFile, globalHeader);

                    /* record (packet) header
                    typedef struct pcaprec_hdr_s {
                        guint32 ts_sec;         timestamp seconds
                        guint32 ts_usec;        timestamp microseconds
                        guint32 incl_len;       number of octets of packet saved in file
                        guint32 orig_len;       actual length of packet
                    } pcaprec_hdr_t; */
                    const recordHeader = Buffer.alloc(4 * 4);

                    tp.onDidChangeData((lines: readonly string[]) => {
                        //console.log(`onDidChangeData(lines.length=${lines.length}`);
                        for (let i = 0; i < lines.length; ++i) {
                            // console.log(`onDidChangeData line='${lines[i]}'`);
                            const line = lines[i].split('\t');

                            const [strSeconds, strMicros] = line[0].split('.');
                            const seconds = Number(strSeconds);
                            const micros = Number(strMicros.slice(0, 6).padEnd(6, '0'));
                            if (line[1].length > 1) {
                                // or optimize to avoid constant reallocs.
                                const bufPayload = Buffer.from(line[1], "hex");
                                // console.log(`onDidChangeData line1.length='${line[1].length}', buyPayload.length=${bufPayload.length}`);
                                // Timestamp: uint32 seconds uint32 micros
                                recordHeader.writeUInt32LE(seconds, 0); // todo secs
                                recordHeader.writeUInt32LE(micros, 4); // nsecs
                                recordHeader.writeUInt32LE(bufPayload.length, 8);
                                recordHeader.writeUInt32LE(bufPayload.length, 12);
                                const res = fs.writeSync(saveFile, recordHeader);
                                const res2 = fs.writeSync(saveFile, bufPayload);
                                console.assert(res === recordHeader.length && res2 === bufPayload.length, 'packet writeSync failed');
                                nrMsgs++;
                            }
                        }
                    });

                    let wasCancelled = false;
                    cancelToken.onCancellationRequested(() => {
                        console.log(`extracting cancelled.`);
                        wasCancelled = true;
                        tp.dispose();
                    });
                    progress.report({ message: `Removing TECMP headers...` });
                    let interval = setInterval(() => {
                        var stats = fs.statSync(saveUri.fsPath);
                        const fileSize = stats["size"] / (1000 * 1000);
                        progress.report({ message: `Removing TECMP ... generated ${nrMsgs} frames and ${Math.round(fileSize)}MB` });
                    }, 1000); // todo could add number of seconds running as well
                    await tp.done().then((res: number) => {
                        fs.closeSync(saveFile);
                        saveFile = -1;
                        vscode.window.showInformationMessage(`successfully extracted ${nrMsgs} frames to file '${saveUri.toString()}'`);
                    }).catch((err) => {
                        console.log(`got err:${err}`);
                        vscode.window.showErrorMessage(`Removing TECMP failed with err=${err}`, { modal: true });
                        fs.closeSync(saveFile);
                        saveFile = -1;
                    });
                    clearInterval(interval);
                }
            );
        }
    }, true);
}
