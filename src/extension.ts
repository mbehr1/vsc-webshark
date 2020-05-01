/* --------------------
 * Copyright(C) Matthias Behr 2020.
 */

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { WebsharkView, SharkdProcess, WebsharkViewSerializer, SelectedTimeData } from './websharkView';
import { statSync } from 'fs';

const extensionId = 'mbehr1.vsc-webshark';
let reporter: TelemetryReporter;

function fileExists(filePath: string) {
	try {
		return statSync(filePath).isFile();
	} catch (err) {
		return false;
	}
}

export function activate(context: vscode.ExtensionContext) {

	console.log(`${extensionId} is now active!`);
	const extension = vscode.extensions.getExtension(extensionId);

	if (extension) {
		const extensionVersion = extension.packageJSON.extensionVersion;
		// the aik is not really sec_ret. but lets avoid bo_ts finding it too easy:
		const strKE = 'ZjJlMDA4NTQtNmU5NC00ZDVlLTkxNDAtOGFiNmIzNTllODBi';
		const strK = Buffer.from(strKE, "base64").toString();
		reporter = new TelemetryReporter(extensionId, extensionVersion, strK);
		context.subscriptions.push(reporter);
		reporter?.sendTelemetryEvent('activate');
	}

	const _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData> = new vscode.EventEmitter<SelectedTimeData>();
	// const onDidChangeSelectedTime: vscode.Event<SelectedTimeData> = this._onDidChangeSelectedTime.event;

	// register our command to open pcap files in webshark view:
	context.subscriptions.push(vscode.commands.registerCommand('webshark.openFile', async () => {
		let _sharkdPath = <string>(vscode.workspace.getConfiguration().get("vsc-webshark.sharkdFullPath"));
		// check if _sharkdPath exists
		if (!fileExists(_sharkdPath)) {
			vscode.window.showErrorMessage(`sharkdFullPath setting not pointing to a file. Please check setting. Currently used: '${_sharkdPath}'`,
				{ modal: true }, 'open settings').then((value) => {
					vscode.commands.executeCommand('workbench.action.openSettings', "vsc-webshark.sharkdFullPath");
				});
		} else {

			return vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, filters: { 'pcap files': ['pcap', 'cap', 'pcapng'] }, openLabel: 'Select pcap file to open...' }).then(
				async (uris: vscode.Uri[] | undefined) => {
					if (uris) {
						uris.forEach((uri) => {
							console.log(`open dlt got URI=${uri.toString()}`);
							const sharkd = new SharkdProcess(_sharkdPath);
							sharkd.ready().then((ready) => {
								if (ready) {
									context.subscriptions.push(new WebsharkView(undefined, context, _onDidChangeSelectedTime, uri, sharkd, (r) => { console.log(` openFile dispose called`); }));
									if (reporter) { reporter.sendTelemetryEvent("open file", undefined, { 'err': 0 }); }
								} else {
									vscode.window.showErrorMessage(`sharkd connection not ready! Please check setting. Currently used: '${_sharkdPath}'`);
									if (reporter) { reporter.sendTelemetryEvent("open file", undefined, { 'err': -1 }); }
								}
							});
						});
					}
				}
			);
		}
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('vsc-webshark',
		new WebsharkViewSerializer(reporter, _onDidChangeSelectedTime, <string>(vscode.workspace.getConfiguration().get("vsc-webshark.sharkdFullPath")),
			context, (r) => { console.log(` openSerialized dispose called`); })));

	let api = {
		onDidChangeSelectedTime(listener: any) { return _onDidChangeSelectedTime.event(listener); }
	};

	return api;
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log(`${extensionId} is deactivated`);
	// todo close them.
}
