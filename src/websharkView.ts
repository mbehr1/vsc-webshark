/* --------------------
 * Copyright(C) Matthias Behr, 2020.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import TelemetryReporter from 'vscode-extension-telemetry';

let _nextSharkdId = 1;

export class SharkdProcess implements vscode.Disposable {
    public id: number;
    private _proc: ChildProcess;
    public running: boolean = false;
    private _ready: boolean = false; // after "Hello in child"
    private _readyPromises: ((value: boolean) => void)[] = [];
    private _partialResponse: Buffer | null = null;
    private _dataTimeout: NodeJS.Timeout | null = null;

    public _onDataFunction: null | ((objs: any[]) => void) = null;

    constructor(public sharkdPath: string) {
        this.id = _nextSharkdId++;
        this._proc = spawn(sharkdPath, ['-'], {
            cwd: '/tmp/',
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });
        this.running = true;
        this._proc.on('error', (err) => {
            console.warn(`SharkdProcess(${this.id}) got error: ${err}`);
            this.running = false;
            this._ready = false;
            this._readyPromises.forEach((p) => p(false));
            this._readyPromises = [];
        });
        this._proc.on('close', (code) => {
            console.log(`SharkdProcess(${this.id}) closed with: ${code}`);
            this.running = false;
            this._ready = false;
            this._readyPromises.forEach((p) => p(false));
            this._readyPromises = [];
        });
        this._proc.stderr?.on('data', (data) => {
            const strData: string = data.toString();
            if (!this._ready) {
                this._ready = strData.startsWith('Hello in child.\n');
                console.log(`SharkdProcess(${this.id}) ready: '${this._ready}', data='${strData}'`);
                this._readyPromises.forEach((p) => p(this._ready));
                this._readyPromises = [];
            } else {
                console.log(`SharkdProcess(${this.id}) stderr: '${strData}'`);
            }
        });
        this._proc.stdout?.on("data", (data) => {
            console.log(`SharkdProcess(${this.id}) got data len=${data.length} '${data.slice(0, 70).toString()}'`);

            if (this._partialResponse) {
                this._partialResponse = Buffer.concat([this._partialResponse, data]);
            } else {
                this._partialResponse = data;
    }

            let jsonObjs: any[] = [];

            let gotObj: boolean;
            do {
                gotObj = false;
                if (this._partialResponse) {
                    const crPos = this._partialResponse.indexOf('\n\n', undefined, "utf8"); // sharkd format is "0+ lines of json reply, finished by empty new line"
                    if (crPos === 0) {
                        console.log(`SharkdProcess(${this.id}) crPos = 0! partialResponse.length=${this._partialResponse.length}`);
                        if (this._partialResponse.length > 1) {
                            // remove the leading \n
                            this._partialResponse = this._partialResponse?.slice(crPos + 2);
                            gotObj = true; // and parse the rest.
                        } else {
                            this._partialResponse = null;
                        }
                    } else {
                        try {
                            let jsonObj = JSON.parse(this._partialResponse.slice(0, crPos > 0 ? crPos : undefined).toString());
                            jsonObjs.push(jsonObj);
                            if (crPos > 0 && crPos < this._partialResponse.length - 2) {
                                console.log(`SharkdProcess(${this.id}) crPos = ${crPos} partialResponse.length=${this._partialResponse.length}`);
                                this._partialResponse = this._partialResponse?.slice(crPos + 2);
                                gotObj = true;
                            } else {
                                this._partialResponse = null;
                                gotObj = false;
                            }
                        } catch (err) {
                            // we can't parse, so keep the buffer.
                        }
                    }
                }
            } while (gotObj);

            if (jsonObjs.length > 0) {
                if (this._dataTimeout) {
                    clearTimeout(this._dataTimeout);
                    this._dataTimeout = null;
                }
                if (this._onDataFunction) { this._onDataFunction(jsonObjs); }
                jsonObjs = [];
            } else {
                console.log(`WebsharkView sharkdCon waiting for more data (got: ${this._partialResponse?.length})`);
                console.log(` ${this._partialResponse?.toString().slice(0, 1000)}`);
                if (this._dataTimeout) {
                    clearTimeout(this._dataTimeout);
                }
                this._dataTimeout = setTimeout(() => {
                    if (this._onDataFunction) { this._onDataFunction([{}]); }
                }, 60000);
            }
        });
    }

    dispose() {
        this._proc.kill(); // send SIGTERM
    }

    ready(): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            if (this._ready && this.running) { resolve(true); return; }
            if (!this.running) { resolve(false); return; }
            this._readyPromises.push(resolve);
        });
    }

    get stdin() {
        return this._proc.stdin;
    }

    get stdout() {
        return this._proc.stdout;
    }
}

export class WebsharkViewSerializer implements vscode.WebviewPanelSerializer {
    constructor(private reporter: TelemetryReporter, private _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData>, private sharkdPath: string, private context: vscode.ExtensionContext, private callOnDispose: (r: WebsharkView) => any) {

    }
    async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
        console.log(`WebsharkView deserializeWebviewPanel called. state='${JSON.stringify(state)}'`);
        try {
            if ('uri' in state) {
                const uri: vscode.Uri = vscode.Uri.parse(state.uri, true);
                console.log(`creating WebsharkView for uri=${uri.toString()}`);

                const sharkd = new SharkdProcess(this.sharkdPath);
                sharkd.ready().then((ready) => {
                    if (ready) {
                        this.context.subscriptions.push(new WebsharkView(webviewPanel, this.context, this._onDidChangeSelectedTime, uri, sharkd, (r) => { console.log(` openFile dispose called`); }));
                        if (this.reporter) { this.reporter.sendTelemetryEvent("open file", undefined, { 'err': 0 }); }
                    } else {
                        vscode.window.showErrorMessage(`sharkd connection not ready! Please check setting. Currently used: '${this.sharkdPath}'`);
                        if (this.reporter) { this.reporter.sendTelemetryEvent("open file", undefined, { 'err': -1 }); }
                    }
                });

            } else { console.warn(`deserializeWebviewPanel but no uri within state='${JSON.stringify(state)}'`); }
        } catch (err) {
            console.warn(`deserializeWebviewPanel got err=${err} with state='${JSON.stringify(state)}'`);
        }
    }
}

interface ResponseData {
    startTime: number;
    id: number;
}

export interface TimeSyncData {
    time: Date,
    id: string,
    value: string,
    prio: number
};

export interface SelectedTimeData {
    time: Date;
    uri: vscode.Uri;
    timeSyncs?: Array<TimeSyncData>; // these are not specific to a selected line. Time will be 0 then.
};

export class WebsharkView implements vscode.Disposable {

    panel: vscode.WebviewPanel | undefined;
    private _gotAliveFromPanel: boolean = false;
    private _msgsToPost: any[] = []; // msgs queued to be send to panel once alive

    lastChangeActive: Date | undefined;
    private _pendingResponses: ResponseData[] = [];

    constructor(panel: vscode.WebviewPanel | undefined, private context: vscode.ExtensionContext, private _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData>, private uri: vscode.Uri, private _sharkd: SharkdProcess, private callOnDispose: (r: WebsharkView) => any) {

        this._pendingResponses.push({ startTime: Date.now(), id: -1 });
        this._sharkd.stdin?.write(`{"req":"load","file":"${uri.fsPath}"}\n`);
        /*this._pendingResponses.push({ startTime: Date.now(), id: -2 });
        this._sharkd.stdin?.write(`{"req":"dumpconf"}\n`);*/

        this._sharkd._onDataFunction =
            (jsonObjs) => {
                console.log(`WebsharkView sharkd got data len=${jsonObjs.length}`);
            if (jsonObjs.length > 0) {
                do {
                    const reqId = this._pendingResponses.shift();
                    const jsonObj = jsonObjs.shift();
                    if (reqId && reqId.id >= 0) {
                        this.postMsgOnceAlive({ command: "sharkd res", res: jsonObj, id: reqId.id });
                        console.log(`WebsharkView sharkd req ${reqId.id} took ${Date.now() - reqId.startTime}ms`);
                    } else {
                        console.log(`WebsharkView sharkdCon got data for reqId=${reqId?.id} after ${Date.now() - (reqId ? reqId.startTime : 0)}ms, data=${JSON.stringify(jsonObj)}`);
                    }
                } while (jsonObjs.length > 0);
                }
            };

        if (panel === undefined) {
            this.panel = vscode.window.createWebviewPanel("vsc-webshark", uri.fsPath.toString(), vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'web'))]
                });
        } else {
            this.panel = panel;
            // todo check options?
        }

        this.panel.onDidDispose(() => {
            console.log(`WebsharkView panel onDidDispose called.`);
            this.panel = undefined;
            this._sharkd.dispose(); // could send 'bye' as well
            this.dispose(); // we close now as well
        });

        this.panel.onDidChangeViewState((e) => {
            console.log(`WebsharkView panel onDidChangeViewState(${e.webviewPanel.active}) called.`);
            if (e.webviewPanel.active) {
                this.lastChangeActive = new Date(Date.now());
            }
        });

        this.panel.webview.onDidReceiveMessage((e) => {
            this._gotAliveFromPanel = true;
            // any messages to post?
            if (this._msgsToPost.length) {
                let msg: any;
                while (msg = this._msgsToPost.pop()) {
                    const msgCmd = msg.command;
                    this.panel?.webview.postMessage(msg).then((onFulFilled) => {
                        console.log(`WebsharkView.postMessage(${msgCmd}) queued ${onFulFilled}`);
                    });
                }
            }
            switch (e.message) {
                case 'sharkd req':
                    try {
                        console.log(`WebsharkView sharkd req(${e.id}/${e.req}) received`);
                        const reqObj = JSON.parse(e.req);
                        switch (reqObj.req) {
                            case 'files':
                                console.log(`WebsharkView sharkd req "files" received`);
                                // special handling. see counterpart in WSCaptureFilesTable.prototype.loadFiles
                                let answerObj = {
                                    'pwd': "home/mbehr",
                                    'files': [{
                                        'name': path.basename(uri.fsPath), 'dir': false, 'size': 100000,
                                        'analysis': { 'first': 1000, 'last': 2000, 'frames': 500, 'protocols': ['tcp'] }
                                    }]
                                }; // todo can be removed
                                this.postMsgOnceAlive({ command: "sharkd res", res: answerObj, id: e.id });
                                break;
                            default:
                                this._pendingResponses.push({ startTime: Date.now(), id: e.id });
                                this._sharkd.stdin?.write(`${e.req}\n`);
                        }
                    } catch (err) {
                        console.warn(`WebsharkView.onDidReceiveMessage sharkd req got err=${err}`, e);
                    }
                    break;
                case 'time update':
                    try {
                        // post time update...
                        const time: Date = new Date(e.time);
                        console.log(`WebsharkView posting time update ${time.toLocaleTimeString()}.${String(time.valueOf() % 1000).padStart(3, "0")}`);
                        this._onDidChangeSelectedTime.fire({ time: time, uri: this.uri });
                    } catch (err) {
                        console.warn(`WebsharkView.onDidReceiveMessage 'time update' got err=${err}`, e);
                    }
                    break;
                default:
                    console.log(`webshark.onDidReceiveMessage e=${e.message}`, e);
                    break;
            }
        });

        // load template and set a html:
        const htmlFile = fs.readFileSync(path.join(this.context.extensionPath, 'web', 'index.html'));
        if (htmlFile.length) {
            let htmlString = htmlFile.toString().replace(/{{localRoot}}/g,
                this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'web'))).toString());

            htmlString = htmlString.replace(/{{fileName}}/g, path.basename(uri.fsPath)).
                replace(/{{uri}}/g, uri.toString());
            this.panel.webview.html = htmlString;
        } else {
            vscode.window.showErrorMessage(`couldn't load web/index.html`);
            // throw?
        }

        this.postMsgOnceAlive({ command: 'ready' });
    }

    dispose() {
        console.log(`WebsharkView dispose called.`);
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
        this.callOnDispose(this);
    }

    postMsgOnceAlive(msg: any) {
        if (this._gotAliveFromPanel) { // send instantly
            const msgCmd = msg.command;
            this.panel?.webview.postMessage(msg).then((onFulFilled) => {
                console.log(`WebsharkView.postMessage(${msgCmd}) direct ${onFulFilled}`);
            });
        } else {
            this._msgsToPost.push(msg);
        }
    };
}
