/* --------------------
 * Copyright(C) Matthias Behr 2020.
 */

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { fileExists, WebsharkView, SharkdProcess, WebsharkViewSerializer, SelectedTimeData, WebsharkViewReadonlyEditorProvider } from './websharkView';
import { TreeViewNode, TreeViewProvider } from './treeViewProvider';
import { filterPcap, extractDlt } from './filterPcap';

const extensionId = 'mbehr1.vsc-webshark';
let reporter: TelemetryReporter;

const _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData> = new vscode.EventEmitter<SelectedTimeData>();
let _didChangeSelectedTimeSubscriptions: Array<vscode.Disposable> = new Array<vscode.Disposable>();
const activeViews: WebsharkView[] = [];
let treeView: vscode.TreeView<TreeViewNode> | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {

	console.log(`${extensionId} is now active! (vscode version=${vscode.version})`);
	const extension = vscode.extensions.getExtension(extensionId);

	if (extension) {
		const extensionVersion = extension.packageJSON.version;
		// the aik is not really sec_ret. but lets avoid bo_ts finding it too easy:
		const strKE = 'ZjJlMDA4NTQtNmU5NC00ZDVlLTkxNDAtOGFiNmIzNTllODBi';
		const strK = Buffer.from(strKE, "base64").toString();
		reporter = new TelemetryReporter(extensionId, extensionVersion, strK);
		context.subscriptions.push(reporter);
		reporter?.sendTelemetryEvent('activate');
	}

	// create treeview
	const treeDataProvider = new TreeViewProvider();
	// todo move to TreeViewprovider?
	treeView = vscode.window.createTreeView('websharkEventsExplorer', { treeDataProvider: treeDataProvider });
	treeDataProvider.treeView = treeView; // the provider should be able to reveal as well
	context.subscriptions.push(treeView);
	context.subscriptions.push(treeDataProvider);
	// subscribe to onDidChangeSelection todo
	context.subscriptions.push(treeView.onDidChangeSelection(event => {
		console.log(`${extensionId}.treeView.onDidChangeSelection(${event.selection.length} ${event.selection[0].uri})`);
		if (event.selection.length && event.selection[0].time !== undefined) {
			// todo (check which activeview has that uri or send to all?)
			for (let i = 0; i < activeViews.length; ++i) {
				activeViews[i].handleDidChangeSelectedTime({ time: new Date(event.selection[0].time.valueOf() + activeViews[i].timeAdjustMs), uri: vscode.Uri.parse('vsc-webshark:///todo') }); // need a different uri for now
			}
		}
	}));

	context.subscriptions.push(vscode.window.registerCustomEditorProvider('vsc-webshark.pcap',
		new WebsharkViewReadonlyEditorProvider(reporter, treeDataProvider, _onDidChangeSelectedTime, context, activeViews, (r) => {
			const idx = activeViews.indexOf(r);
			console.log(` WebsharkViewReadonlyEditorProvider callback dispose called( r idx = ${idx}) activeViews=${activeViews.length}`);
			if (idx >= 0) {
				activeViews.splice(idx, 1);
			}
		}),
		{
			webviewOptions: { retainContextWhenHidden: true, },
			supportsMultipleEditorsPerDocument: false
		}));

	// register our command to open pcap files in webshark view:
	context.subscriptions.push(vscode.commands.registerCommand('webshark.openFile', async () => {
		let _sharkdPath = <string>(vscode.workspace.getConfiguration().get("vsc-webshark.sharkdFullPath"));
		// check if _sharkdPath exists
		if (!fileExists(_sharkdPath)) {
			vscode.window.showErrorMessage(`sharkdFullPath setting not pointing to a file. Please check setting. Currently used: '${_sharkdPath}'`,
				{ modal: true }, 'open settings').then((value) => {
					switch (value) {
						case 'open settings':
							vscode.commands.executeCommand('workbench.action.openSettings', "vsc-webshark.sharkdFullPath");
							break;
					}
				});
		} else {

			return vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, filters: { 'pcap files': ['pcap', 'cap', 'pcapng'] }, openLabel: 'Select pcap file to open...' }).then(
				async (uris: vscode.Uri[] | undefined) => {
					if (uris) {
						uris.forEach((uri) => {
							console.log(`webshark.openFile got URI=${uri.toString()}`);
							const sharkd = new SharkdProcess(_sharkdPath);
							sharkd.ready().then((ready) => {
								if (ready) {
									context.subscriptions.push(new WebsharkView(undefined, context, treeDataProvider, _onDidChangeSelectedTime, uri, sharkd, activeViews, (r) => {
										const idx = activeViews.indexOf(r);
										console.log(` openFile dispose called( r idx = ${idx}) activeViews=${activeViews.length}`);
										if (idx >= 0) {
											activeViews.splice(idx, 1);
										}
									}));
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

	context.subscriptions.push(vscode.commands.registerCommand('webshark.filterPcap', async () => {
		return vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, filters: { 'pcap files': ['pcap', 'cap', 'pcapng'] }, openLabel: 'Select pcap file to filter...' }).then(
			async (uris: vscode.Uri[] | undefined) => {
				if (uris && uris.length > 0) {
					console.log(`webshark.filterPcap got #URIs=${uris.length}`);
					if (reporter) { reporter.sendTelemetryEvent("filter pcap", undefined, { 'err': 0 }); }
					filterPcap(uris);

				}
			}
		);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('webshark.extractDlt', async () => {
		return vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, filters: { 'pcap files': ['pcap', 'cap', 'pcapng'] }, openLabel: 'Select pcap file to extract DLT from...' }).then(
			async (uris: vscode.Uri[] | undefined) => {
				if (uris && uris.length > 0) {
					console.log(`webshark.extractDlt got #URIs=${uris.length}`);
					if (reporter) { reporter.sendTelemetryEvent("extract dlt", undefined, { 'err': 0 }); }
					extractDlt(uris);
				}
			}
		);
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('vsc-webshark',
		new WebsharkViewSerializer(reporter, treeDataProvider, _onDidChangeSelectedTime, <string>(vscode.workspace.getConfiguration().get("vsc-webshark.sharkdFullPath")),
			context, activeViews, (r) => {
				const idx = activeViews.indexOf(r);
				console.log(` openSerialized dispose called( r idx = ${idx}) activeViews=${activeViews.length}`);
				if (idx >= 0) {
					activeViews.splice(idx, 1);
				}
			})));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((ev) => {
		for (let i = 0; i < activeViews.length; ++i) {
			activeViews[i].onDidChangeConfiguration(ev);
		}
	}));

	let handleDidChangeSelectedTime = function (ev: SelectedTimeData): void {
		//console.log(`${extensionId}.handleDidChangeSelectedTime called...`);
		for (let i = 0; i < activeViews.length; ++i) {
			activeViews[i].handleDidChangeSelectedTime(ev);
		}
	};

	const checkActiveExtensions = function () {
		_didChangeSelectedTimeSubscriptions.forEach((value) => {
			if (value !== undefined) {
				value.dispose();
			}
		});
		while (_didChangeSelectedTimeSubscriptions.length) { _didChangeSelectedTimeSubscriptions.pop(); }
		let newSubs: vscode.Disposable[] = [];
		vscode.extensions.all.forEach((value) => {
			if (value.isActive) {
				try {
					let importedApi = value.exports;
					if (importedApi !== undefined) {
						let subscr = importedApi.onDidChangeSelectedTime(async (ev: SelectedTimeData) => {
							handleDidChangeSelectedTime(ev);
						});
						if (subscr !== undefined) {
							console.log(` got onDidChangeSelectedTime api from ${value.id}`);
							newSubs.push(subscr);
						}
					}
				} catch (error) {
					console.log(`${extensionId}.extension ${value.id} throws: ${error}`);
				}
			}
		});
		_didChangeSelectedTimeSubscriptions = newSubs;
		console.log(`${extensionId}.checkActiveExtensions: got ${_didChangeSelectedTimeSubscriptions.length} subscriptions.`);
	};

	// time-sync feature: check other extensions for api onDidChangeSelectedTime and connect to them.
	// we do have to connect to ourself as well (as we do broadcast within pcap files)
	context.subscriptions.push(vscode.extensions.onDidChange(() => {
		setTimeout(() => {
			console.log(`${extensionId}.extensions.onDidChange #ext=${vscode.extensions.all.length}`);
			checkActiveExtensions();
		}, 2000);
	}));
	setTimeout(() => {
		checkActiveExtensions();
	}, 2000);

	let api = {
		onDidChangeSelectedTime(listener: any) { return _onDidChangeSelectedTime.event(listener); }
	};

	return api;
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log(`${extensionId} is deactivated. activeViews=${activeViews.length}`);
	// todo close activeViews
	_didChangeSelectedTimeSubscriptions.forEach((value) => {
		if (value !== undefined) {
			value.dispose();
		}
	});
}
