/* --------------------
 * Copyright(C) Matthias Behr, 2020 - 2021.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import TelemetryReporter from '@vscode/extension-telemetry';
import { TreeViewProvider, TreeViewNode } from './treeViewProvider';
import { fileExistsOrPick } from './utils';
let _nextSharkdId = 1;

const platformWin32: boolean = process.platform === 'win32';
const platformNewline: string = platformWin32 ? '\r\n' : '\n'; // what a mess... sharkd on win (or cmd) translates newlines into \r\n
const platformDoubleNewLine = platformWin32 ? '\r\n' : '\n'; // only needed to parse output, input is accepted with single newline
const platformDoubleNewLineLen = platformDoubleNewLine.length;

export function fileExists(filePath: string) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export class SharkdProcess implements vscode.Disposable {
  public id: number;
  private _proc: ChildProcess;
  public running: boolean = false;
  private _ready: boolean = false; // after "Hello in child"
  private _readyPromises: ((value: boolean) => void)[] = [];
  private _partialResponse: Buffer | null = null;
  private _dataTimeout: NodeJS.Timeout | null = null;

  public _onDataFunction: null | ((objs: any[]) => void) = null;

  private _notReadyErrData: string = '';

  constructor(public sharkdPath: string, public wiresharkProfile?: string) {
    this.id = _nextSharkdId++;
    const { base: sharkdCmd, dir: sharkdDirParsed } = path.parse(sharkdPath);
    const sharkdDir = sharkdDirParsed.length > 0 ? sharkdDirParsed : process.cwd();
    // either call sharkd the usual way: "sharkd -""
    // or use "sharkd -C <profile>", if wiresharkProfile was provided
    const spawnArgs = [...(wiresharkProfile ? ['-C', wiresharkProfile] : ['-'])];
    console.log(`SharkdProcess spawning '${sharkdCmd}' args:${JSON.stringify(spawnArgs)} from cwd='${sharkdDir}' win32=${platformWin32}`);
    this._proc = spawn(sharkdCmd, spawnArgs, {
      cwd: sharkdDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true, // we want to be able to call e.g. .bat/.cmd files
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
        this._notReadyErrData = this._notReadyErrData.concat(strData);
        this._ready = this._notReadyErrData.indexOf(`Hello in child.${platformNewline}`) >= 0;
        if (this._ready) {
          console.log(`SharkdProcess(${this.id}) ready: '${this._ready}', data='${this._notReadyErrData}'`);
          this._readyPromises.forEach((p) => p(this._ready));
          this._readyPromises = [];
        } // todo add timeout and promise(false)
      } else {
        if (!strData.startsWith('load:')) {
          console.warn(`SharkdProcess(${this.id}) unexpected stderr: '${strData}'`);
          vscode.window.showWarningMessage(`sharkd sent unexpected stderr: '${strData}'`);
        } else {
          console.log(`SharkdProcess(${this.id}) stderr: '${strData}'`);
        }
      }
    });
    this._proc.stdout?.on('data', (data) => {
      //console.log(`SharkdProcess(${this.id}) got data len=${data.length} '${data.slice(0, 70).toString()}'`);

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
          const crPos = this._partialResponse.indexOf(platformDoubleNewLine, undefined, 'utf8'); // sharkd format is "0+ lines of json reply, finished by empty new line (only prev 3.5 wireshark)"
          if (crPos === 0) {
            console.warn(
              `SharkdProcess(${this.id}) crPos = 0! partialResponse.length=${
                this._partialResponse.length
              } resp=${this._partialResponse.toString()}`
            );
            if (this._partialResponse.length > 1) {
              // remove the leading \n
              this._partialResponse = this._partialResponse?.subarray(crPos + platformDoubleNewLineLen);
              gotObj = true; // and parse the rest.
            } else {
              this._partialResponse = null;
            }
          } else {
            try {
              let jsonObj = JSON.parse(this._partialResponse.subarray(0, crPos > 0 ? crPos : undefined).toString());
              jsonObjs.push(jsonObj);
              if (crPos > 0 && crPos < this._partialResponse.length - platformDoubleNewLineLen) {
                console.log(`SharkdProcess(${this.id}) crPos = ${crPos} partialResponse.length=${this._partialResponse.length}`);
                this._partialResponse = this._partialResponse?.subarray(crPos + platformDoubleNewLineLen);
                gotObj = true;
              } else {
                this._partialResponse = null;
                gotObj = false;
              }
            } catch (err) {
              // we can't parse, so keep the buffer.
              console.log(
                `SharkdProcess(${this.id}) crPos = ${crPos} partialResponse.length=${this._partialResponse!.length} got err=${err}` // partialResponse=${this._partialResponse?.toString()}`
              );
            }
          }
        }
      } while (gotObj);

      if (jsonObjs.length > 0) {
        if (this._dataTimeout) {
          clearTimeout(this._dataTimeout);
          this._dataTimeout = null;
        }
        if (this._onDataFunction) {
          this._onDataFunction(jsonObjs);
        }
        jsonObjs = [];
      } else {
        //console.log(`WebsharkView sharkdCon waiting for more data (got: ${this._partialResponse?.length})`);
        // console.log(` ${this._partialResponse?.toString().slice(0, 1000)}`);
        if (this._dataTimeout) {
          clearTimeout(this._dataTimeout);
          this._dataTimeout = null;
        }
        this._dataTimeout = setTimeout(() => {
          if (this._onDataFunction) {
            this._onDataFunction([{ error: { code: 3, message: 'timeout' } }]);
          }
        }, 60000);
      }
    });
  }

  dispose() {
    this._proc.kill(); // send SIGTERM
  }

  ready(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this._ready && this.running) {
        resolve(true);
        return;
      }
      if (!this.running) {
        resolve(false);
        return;
      }
      this._readyPromises.push(resolve);
    });
  }

  sendRequest(req: string) {
    if (!this._proc.stdin) {
      console.error(`SharkdProcess.sendRequest called but proc.stdin null!`);
    } else {
      this._proc.stdin.write(`${req}\n`);
    }
  }
  sendRequestObj(req: object) {
    this.sendRequest(JSON.stringify(req));
  }
}

export class WebsharkViewSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private reporter: TelemetryReporter,
    private treeViewProvider: TreeViewProvider,
    private _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData>,
    private sharkdPath: string,
    private context: vscode.ExtensionContext,
    private activeViews: WebsharkView[],
    private callOnDispose: (r: WebsharkView) => any
  ) {}
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
    console.log(`WebsharkView deserializeWebviewPanel called. state='${JSON.stringify(state)}'`);
    try {
      if ('uri' in state) {
        const uri: vscode.Uri = vscode.Uri.parse(state.uri, true);
        console.log(`creating WebsharkView for uri=${uri.toString()}`);

        const sharkd = new SharkdProcess(this.sharkdPath);
        sharkd.ready().then((ready) => {
          if (ready) {
            this.context.subscriptions.push(
              new WebsharkView(
                webviewPanel,
                this.context,
                this.treeViewProvider,
                this._onDidChangeSelectedTime,
                uri,
                sharkd,
                this.activeViews,
                this.callOnDispose
              )
            );
            if (this.reporter) {
              this.reporter.sendTelemetryEvent('open file', undefined, { err: 0 });
            }
          } else {
            vscode.window.showErrorMessage(`sharkd connection not ready! Please check setting. Currently used: '${this.sharkdPath}'`);
            if (this.reporter) {
              this.reporter.sendTelemetryEvent('open file', undefined, { err: -1 });
            }
          }
        });
      } else {
        console.warn(`deserializeWebviewPanel but no uri within state='${JSON.stringify(state)}'`);
      }
    } catch (err) {
      console.warn(`deserializeWebviewPanel got err=${err} with state='${JSON.stringify(state)}'`);
    }
  }
}

class WebsharkViewCustomDocument implements vscode.CustomDocument {
  constructor(public uri: vscode.Uri) {
    console.log(`WebsharkViewCustomDocument(uri=${this.uri.toString()}) called`);
  }
  dispose() {
    console.log(`WebsharkViewCustomDocument dispose(uri=${this.uri.toString()}) called`);
  }
}

export class WebsharkViewReadonlyEditorProvider implements vscode.CustomReadonlyEditorProvider<WebsharkViewCustomDocument> {
  constructor(
    private reporter: TelemetryReporter,
    private treeViewProvider: TreeViewProvider,
    private _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData>,
    private context: vscode.ExtensionContext,
    private activeViews: WebsharkView[],
    private callOnDispose: (r: WebsharkView) => any
  ) {}
  openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Thenable<WebsharkViewCustomDocument> | WebsharkViewCustomDocument {
    console.log(
      `WebsharkViewReadonlyEditorProvider openCustomDocument(uri=${uri.toString()}, openContext=${JSON.stringify(openContext)}) called`
    );
    // we dont support backupId yet (necessary for readonly at all?)
    return new WebsharkViewCustomDocument(uri);
  }
  resolveCustomEditor(
    document: WebsharkViewCustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Thenable<void> | void {
    console.log(
      `WebsharkViewReadonlyEditorProvider resolveCustomEditor(document.uri=${document.uri.toString()}, webviewPanel:${webviewPanel}) called`
    );
    const _wiresharkProfile = <string>vscode.workspace.getConfiguration().get('vsc-webshark.wiresharkProfile');
    fileExistsOrPick('vsc-webshark.sharkdFullPath', 'sharkd')
      .then((filePath) => {
        const sharkd = new SharkdProcess(filePath, _wiresharkProfile);
        sharkd.ready().then((ready) => {
          if (ready) {
            this.context.subscriptions.push(
              new WebsharkView(
                webviewPanel,
                this.context,
                this.treeViewProvider,
                this._onDidChangeSelectedTime,
                document.uri,
                sharkd,
                this.activeViews,
                this.callOnDispose
              )
            );
            if (this.reporter) {
              this.reporter.sendTelemetryEvent('open file resolve custom editor', { fn: 'resolveCustomEditor' }, { err: 0 });
            }
          } else {
            vscode.window.showErrorMessage(`sharkd connection not ready! Please check setting. Currently used: '${filePath}'`);
            if (this.reporter) {
              this.reporter.sendTelemetryEvent('open file resolve custom editor', { fn: 'resolveCustomEditor' }, { err: -1 });
            }
          }
        });
      })
      .catch((err) => {
        throw Error(`sharkdPath not valid: ${err}`);
      });
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

    private _sharkd2: SharkdProcess; // we keep a 2nd for indexing in parallel...
    private _sharkd2Cbs: { id: number, startTime: number, req: any, cb: ((jsonObj: object) => void) }[] = [];

    // timer interval infos:
    private _sharkd2Info: any; // objected returned on 'info' request. Has columns,...
    private _utcTimeColumnIdx: number = -1;
    private _fileStatus: any; // the object returned on 'status' request. Has frames, duration (time diff betw first and last) as properties
    private _firstFrame: any; // first frame from the unfiltered file
    private _firstFrameTime: Date | undefined;
    private _firstInfosLoaded: boolean = false;
    private _activeFilter: string | undefined;
    private _timeIntsBySec: any; // the object returned on last 'intervals' request.
    private _timeAdjustMs: number = 0;

    get timeAdjustMs(): number { return this._timeAdjustMs; }; // readonly

    // time sync support:
    public gotTimeSyncEvents: boolean = false; // we reacted to time sync events ( so manually adjusting doesn't make sense as it will change back autom.)
    lastSelectedTimeEv: Date | undefined; // the last received time event that might have been used to reveal our line. used for adjustTime on last event feature.
    private _timeSyncEvents: TimeSyncData[] = [];

    // tree view support:
    private _treeViewProvider: TreeViewProvider;
    private _treeNode: TreeViewNode;
    private _eventsNode: TreeViewNode;

    constructor(panel: vscode.WebviewPanel | undefined, private context: vscode.ExtensionContext, private treeViewProvider: TreeViewProvider, private _onDidChangeSelectedTime: vscode.EventEmitter<SelectedTimeData>, private uri: vscode.Uri, private _sharkd: SharkdProcess, activeViews: WebsharkView[], private callOnDispose: (r: WebsharkView) => any) {

        this._treeViewProvider = treeViewProvider;
        this._treeNode = new TreeViewNode(path.basename(uri.fsPath), null, 'file-binary');
        this._eventsNode = new TreeViewNode('events', this._treeNode, 'symbol-event');
        this._treeNode.children.push(this._eventsNode);

        treeViewProvider.treeRootNodes.push(this._treeNode);
        treeViewProvider.updateNode(this._treeNode, true, true);

        this._pendingResponses.push({ startTime: Date.now(), id: 1 });
        this._sharkd.sendRequestObj({ method: 'load', params: { file: uri.fsPath }, jsonrpc: "2.0", id: 1 });

        this._sharkd._onDataFunction =
            (jsonObjs) => {
                try {
                    // console.log(`WebsharkView sharkd got data len=${jsonObjs.length}`);
                    if (jsonObjs.length > 0) {
                        do {
                            const reqId = this._pendingResponses.shift();
                            const jsonObj = jsonObjs.shift();
                            if (reqId && reqId.id > 1) { // 1 is used specifically
                                this.postMsgOnceAlive({ command: "sharkd res", res: jsonObj, id: reqId.id });
                                console.log(`WebsharkView sharkd req ${reqId.id} took ${Date.now() - reqId.startTime}ms`);
                            } else {
                                console.log(`WebsharkView sharkdCon got data for reqId=${reqId?.id} after ${Date.now() - (reqId ? reqId.startTime : 0)}ms, data=${JSON.stringify(jsonObj)}`);
                            }
                        } while (jsonObjs.length > 0);
                    }
                } catch (e) {
                    console.warn(`WebsharkView sharkd got e=${e}`);
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
            // ensure proper options are set
            console.log(`WebsharkView(panel.options=${JSON.stringify(this.panel.options)}, webview.options=${JSON.stringify(this.panel.webview.options)})`);
            panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'web'))] };
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
                while (msg = this._msgsToPost.shift()) { // keep FIFO order
                    const msgCmd = msg.command;
                    this.panel?.webview.postMessage(msg).then((onFulFilled) => {
                        console.log(`WebsharkView.postMessage(${msgCmd}) queued ${onFulFilled}`);
                    });
                }
            }
            switch (e.message) {
                case 'sharkd req':
                    try {
                        console.log(`WebsharkView sharkd req(${e.id}/${e.req}) received`); // todo e.id is not equal to reqObj.id... (but should)
                        const oldReq = JSON.parse(e.req);
                        const reqObj = this.convertToWireshark35Req(oldReq);
                        switch (oldReq.req) {
                            case 'files':
                                console.log(`WebsharkView sharkd req "files" received`);
                                // special handling. see counterpart in WSCaptureFilesTable.prototype.loadFiles
                                let answerObj = {
                                    result: {
                                        'pwd': "home/mbehr",
                                        'files': [{
                                            'name': path.basename(uri.fsPath), 'dir': false, 'size': 100000,
                                            'analysis': { 'first': 1000, 'last': 2000, 'frames': 500, 'protocols': ['tcp'] }
                                        }]
                                    }
                                }; // todo can be removed
                                this.postMsgOnceAlive({ command: "sharkd res", res: answerObj, id: e.id });
                                break;
                            default:
                                this._pendingResponses.push({ startTime: Date.now(), id: e.id });
                                this._sharkd.sendRequestObj(reqObj);
                        }
                    } catch (err) {
                        console.warn(`WebsharkView.onDidReceiveMessage sharkd req got err=${err}`, e);
                    }
                    break;
                case 'time update':
                    try {
                        // post time update...
                        const time: Date = new Date(new Date(e.time).valueOf() + this._timeAdjustMs);
                        console.log(`WebsharkView posting time update ${time.toLocaleTimeString()}.${String(time.valueOf() % 1000).padStart(3, "0")}`);
                        this._onDidChangeSelectedTime.fire({ time: time, uri: this.uri });
                    } catch (err) {
                        console.warn(`WebsharkView.onDidReceiveMessage 'time update' got err=${err}`, e);
                    }
                    break;
                case 'adjust time req':
                    {
                        this.adjustTimeReq(e);
                    }
                    break;
                case 'set filter':
                    try {
                        console.log(`WebsharkView 'set filter' filter=${JSON.stringify(e.filter)}`);
                        this._activeFilter = e.filter;
                        // we load the new time indices...
                        // but only if first infos are not loaded yet. Otherwise it happens autom.
                        if (this._firstInfosLoaded) { this.updateTimeIndices(this._activeFilter); }
                    } catch (err) {
                        console.warn(`WebsharkView.onDidReceiveMessage 'set' got err=${err}`, e);
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
        // send config (could remove the ready)
        const configColumns = <any[]>(vscode.workspace.getConfiguration().get("vsc-webshark.columns"));
        const configColumnsWidths = <any>(vscode.workspace.getConfiguration().get("vsc-webshark.columnsWidths"));
        this.onConfigColumnsChange(configColumns, configColumnsWidths);

        // start the 2nd sharkd process last:
        this._sharkd2 = new SharkdProcess(this._sharkd.sharkdPath);
        this._sharkd2._onDataFunction = (jsonObjs) => {
            for (let i = 0; i < jsonObjs.length; ++i) {
                const cb = this._sharkd2Cbs.shift();
                if (cb !== undefined) {
                    console.log(`WebsharkView sharkd2 req id ${cb.id} ${JSON.stringify(cb.req)} took ${Date.now() - cb.startTime}ms.`);
                    if (cb.id !== jsonObjs[i].id) {
                        console.error(`request/response id mismatch! ${cb.id} vs ${jsonObjs[i].id} for ${JSON.stringify(jsonObjs[i])}`);
                        cb.cb({ error: { code: 2, message: `request/response id mismatch! ${cb.id} vs ${jsonObjs[i].id}` } });
                    } else {
                        // console.warn(`sharkd2 got response:${JSON.stringify(jsonObjs[i])}`);
                        cb.cb(jsonObjs[i]);
                    }
                } else {
                    console.error(`WebsharkView sharkd2 got data but have no cb! obj=${JSON.stringify(jsonObjs[i])}`);
                }
            }
        };

        // load config for sharkd

        const sharkdConf = <any[]>(vscode.workspace.getConfiguration().get("vsc-webshark.sharkdConfigurations"));
        for (const conf of sharkdConf) {
          this.sharkd2Request({ req: 'setconf', params: { name: conf.name, value: conf.value } }, (res: any) => {
            console.log(`WebsharkView sharkd2 'setconf ${conf.name}=${conf.value}' got res=${JSON.stringify(res)}`);
            if ('error' in res) {
                console.error(`WebsharkView sharkd2 'setconf' got error=${res.error}`);
                // if not err: 0 we could e.g. kill and don't offer time services...
            }
          });
        }

        // load the file here as well: todo might delay until the first one has fully loaded the file
        // but with all our multi-core cpus it should run fine in parallel... todo
        // as long as sharkd2 is not ready it's not granted that requests are done in fifo order.

        this.sharkd2Request({ req: 'load', file: uri.fsPath }, (res: any) => {
            console.log(`WebsharkView sharkd2 'load file' got res=${JSON.stringify(res)}`);
            if ('error' in res) {
                console.error(`WebsharkView sharkd2 'load file' got error=${res.error}`);
                // if not err: 0 we could e.g. kill and don't offer time services...
            }

            // load the column infos:
            this.sharkd2Request({ req: 'info' }, (res: any) => {
                if ('error' in res) {
                    console.warn(`WebsharkView sharkd2 'info' got error=${JSON.stringify(res)}`);
                } else {
                    console.log(`WebsharkView sharkd2 'info' got sharkd version=${res.result.version}`);
                    this._sharkd2Info = res.result;
                    let idx = this.getColumnIdx('%Yut');
                    if (idx !== undefined) { this._utcTimeColumnIdx = idx; }
                    if (this._utcTimeColumnIdx < 0) {
                        console.warn(`WebsharkView couldn't determine utc time column!`);
                    } else {
                        // load the status info:
                        this.sharkd2Request({ req: 'status' }, (res: any) => {
                            if ('error' in res) {
                                console.warn(`WebsharkView sharkd2 'status' got error=${JSON.stringify(res)}`);
                            } else {
                                console.log(`WebsharkView sharkd2 'status' res=${JSON.stringify(res.result)}`);
                                this._fileStatus = res.result;

                                // load the first frame to get the abs time reference:
                                this.sharkd2Request({ req: 'frames', limit: 1, column0: this._utcTimeColumnIdx }, (res: any) => {
                                    try {
                                      if ('error' in res) {
                                        console.warn(`WebsharkView sharkd2 'frames' got error=${JSON.stringify(res)}`);
                                      } else {
                                        if (res && res.result && Array.isArray(res.result) && res.result.length > 0) {
                                          const result = res.result;
                                          console.log(
                                            `WebsharkView sharkd2 'frames' got frame #${result[0].num} res=${JSON.stringify(result).slice(
                                              0,
                                              200
                                            )}`
                                          );
                                          this._firstFrame = result;
                                          this._firstFrameTime = new Date(result[0].c[0]);
                                          console.log(`WebsharkView firstFrameTime (non adjusted)=${this._firstFrameTime.toUTCString()}`);

                                          this._firstInfosLoaded = true;
                                          this.updateTimeIndices(this._activeFilter);
                                          this.scanForEvents();
                                        } else {
                                          console.error(`WebsharkView sharkd2 'frames' got invalid result. res=${JSON.stringify(res)}`);
                                        }
                                      }
                                    } catch (err) {
                                      console.error(`WebsharkView sharkd2 'frames' catched err=${err}`);
                                    }
                                });
                            }
                        });
                    }
                }
            });
        });
        activeViews.push(this);
    }

    dispose() {
        console.log(`WebsharkView dispose called.`);
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
        this._sharkd2.dispose();

        const idx = this._treeViewProvider.treeRootNodes.indexOf(this._treeNode);
        if (idx >= 0) { this._treeViewProvider.treeRootNodes.splice(idx, 1); this._treeViewProvider.updateNode(null); }

        this.callOnDispose(this);
    }

    onConfigColumnsChange(configColumns: any[], configColumnsWidths: any) {
        this.postMsgOnceAlive({
            command: 'config update', config: {
                columns_width: configColumnsWidths && typeof configColumnsWidths === 'object' ? configColumnsWidths :
                    { // see https://github.com/wireshark/wireshark/blob/20800366ddbbb2945491120afe7265796c26bf11/epan/column.c
                        '%m': 1.7 * 59,
                        '%t': 1.7 * 70, // %At for abs time 94,
                        '%s': 1.7 * 154,
                        '%d': 1.7 * 154,
                        '%p': 1.7 * 56,
                        '%L': 1.7 * 48,
                        // '%i'
                    },
                columns: configColumns && Array.isArray(configColumns) && configColumns.length > 0 ? configColumns :
                    [
                        { "No.": "%m" },
                        { "Time": "%t" },
                        { "Source2": "%s" },
                        { "Destination": "%d" },
                        { "Protocol": "%p" },
                        { "Length": "%L" },
                        { "Info": "%i" },
                    ],
            }
        });
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

    convertToWireshark35Req(req: object) {
        const reqId = ++this.lastReqId;

        const newReq = {
            method: '<unknown>',
            params: {} as any,
            jsonrpc: "2.0",
            id: reqId
        };
        Object.entries(req).forEach(([key, value]) => {
            if (key === 'req') {
                newReq.method = value;
            } else {
                newReq.params[key] = value;
            }
        });
        return newReq;
    }

    lastReqId: number = 0;

    /**
     * Send a request to sharkd.
     * @param req object with req:string and other keys that form the params. Will be converted to new wireshark sharkd format
     * @param cb function that will received the jsonrpc 2.0 response object from that request. Members:
     *   jsonrpc, id and on success: result or on error: error object.
     */
    sharkd2Request(req: object, cb: (res: object) => void) {
        // starting with wireshark 3.5 the command syntax has been changed.
        // instead of an object with req and the params inside it now needs an object with:
        // method: (the former req)
        // params: object with the parameters
        // jsonrpc: "2.0"
        // id: a pos number unique id per request
        // we convert here with the following rules:
        // req -> method
        // all other keys -> params

        const newReq = this.convertToWireshark35Req(req);

        //console.warn(`sharkd2Request converted ${JSON.stringify(req)} to ${JSON.stringify(newReq)}`);

        this._sharkd2.ready().then((ready) => {
            if (ready) {
                this._sharkd2.sendRequestObj(newReq);
                this._sharkd2Cbs.push({ id: newReq.id, startTime: Date.now(), req: req, cb: cb });
            } else {
                console.error(`WebsharkView sharkd2 not ready for req ${JSON.stringify(req)}`);
                cb({ error: { code: 1, message: 'sharkd2 not ready' } });
            }
        });
    }

    updateTimeIndices(filter: string | undefined) {
        console.log(`WebsharkView.updateTimeIndices(filter='${filter}')`);
        let req: any = { req: 'intervals', interval: 1000 /* sec */ }; // todo if this ever gets too large we might have to add hours as interims.
        if (filter && filter.length > 0) { req.filter = filter; }
        this.sharkd2Request(req, (res: any) => {
            if ('error' in res) {
                console.warn(`WebsharkView sharkd2 'intervals' got error=${JSON.stringify(res)}`);
            } else {
                const result = res.result;
                console.log(`WebsharkView.updateTimeIndices got result for 'intervals' result=${JSON.stringify(result).slice(0, 100)}`);
                console.log(`WebsharkView.updateTimeIndices  frames=${result.frames} last=${result.last} #intervals=${result.intervals.length}`);
                this._timeIntsBySec = result;
                // we add the filter info:
                if (req.filter && req.filter.length > 0) { this._timeIntsBySec.filter = req.filter; }
                vscode.window.showInformationMessage('time indices available'); // put into status bar item todo
            }
        });
    }

    getFrameIdxForTime(time: Date): Promise<number | null> {
        // we return null, if the time filter doesn't match yet... (todo optimize this)
        console.log(`WebsharkView.getFrameIdxForTime(${time.toUTCString()}.${time.valueOf() % 1000})...`);
        return new Promise((resolve) => {
            const activeFilterStr: string = this._activeFilter ? this._activeFilter : '';
            const timeIntsFilterStr: string = this._timeIntsBySec && this._timeIntsBySec.filter ? this._timeIntsBySec.filter : '';
            if (!this._timeIntsBySec || (activeFilterStr !== timeIntsFilterStr)) { resolve(null); return; }
            if (!this._firstFrameTime || !this._fileStatus) { resolve(null); return; }
            const timeVal = time.valueOf();
            const firstFrameTimeVal = this._firstFrameTime.valueOf() + this._timeAdjustMs;
            const durationMs = this._fileStatus.duration * 1000; // number in secs, -> ms.

            if (firstFrameTimeVal > timeVal) { resolve(0); console.warn(`WebsharkView.getFrameIdxForTime returning 0 due to > time`); return; }
            if (firstFrameTimeVal + durationMs < timeVal) { resolve(null); console.warn(`WebsharkView.getFrameIdxForTime returning null due to last < time`); return; }

            // ok. we're within...
            // search the sec indices.
            const timeInts = this._timeIntsBySec.intervals; // [idx of interval, numer of frames, number of bytes]
            const timeValOffset = timeVal - firstFrameTimeVal;
            let startIdx = 0;
            let i;
            for (i = 0; i < timeInts.length; ++i) {
                const interval = timeInts[i];
                const intStartTime = 1000 * interval[0];
                const intEndTime = intStartTime + 1000;
                if (intEndTime > timeValOffset) { // todo check for very first!
                    if (intStartTime >= timeValOffset) {
                        console.log(`WebsharkView.getFrameIdxForTime returning start of intervall at idx=${startIdx}.`);
                        resolve(startIdx); // this is the closest element >=..
                        return;
                    }
                    // found the right interval but need to search the closest one within:
                    break;
                }
                startIdx += interval[1];
            }
            if (startIdx >= this._fileStatus.frames) {
                console.warn(`WebsharkView.getFrameIdxForTime returning null (startIdx=${startIdx}>=${this._fileStatus.frames}). Logical error?`);
                resolve(null);
                return;
            }
            // found the right interval i but need to search the closest one within:
            console.log(`WebsharkView.getFrameIdxForTime searching interval ${i} with ${timeInts[i][1]} frames at startIdx=${startIdx}`);
            // for now search via frames:
            // load the first frame to get the abs time reference:
            this.sharkd2Request({ req: 'frames', filter: this._activeFilter, skip: startIdx, limit: timeInts[i][1], column0: this._utcTimeColumnIdx }, (res: any) => {
                if ('error' in res) {
                    console.warn(`WebsharkView sharkd2 'frames' got error=${JSON.stringify(res)}`);
                } else {
                    const result = res.result;
                    console.log(`WebsharkView sharkd2 search 'frames' got frame #${result[0].num} result=${JSON.stringify(result).slice(0, 200)}`);
                    // iterate through all frames:
                    let j;
                    for (j = 0; j < result.length; ++j) {
                        const frameTime = new Date(result[j].c[0]);
                        if ((frameTime.valueOf() + this._timeAdjustMs) >= timeVal) {
                            console.log(`WebsharkView.getFrameIdxForTime precise frame idx=${startIdx + j} time(not adj)=${frameTime.toUTCString()}.${frameTime.valueOf() % 1000}`);
                            resolve(startIdx + j);
                            return;
                        }
                    }
                    if (startIdx + j >= this._fileStatus.frames) {
                        console.warn(`WebsharkView.getFrameIdxForTime returning null (startIdx=${startIdx + j}>=${this._fileStatus.frames})`);
                        resolve(null);
                    }
                    console.log(`WebsharkView.getFrameIdxForTime didnt found in frames. returning next one idx=${startIdx + j}.`);
                    resolve(startIdx + j);
                }
            });
        });
    }

    async handleDidChangeSelectedTime(ev: SelectedTimeData) {
        if (this.uri.toString() !== ev.uri.toString()) { // avoid reacting on our own events...
            console.log(`WebsharkView.handleDidChangeSelectedTime got ev from uri=${ev.uri.toString()}`);
            if (ev.time.valueOf() > 0) {
                this.lastSelectedTimeEv = ev.time;
                if (this._firstFrameTime !== undefined) {
                    this.getFrameIdxForTime(new Date(ev.time.valueOf())).then((idx) => {
                        console.warn(`WebsharkView.handleDidChangeSelectedTime got idx=${idx} for ${ev.time.toUTCString()}`);
                        if (idx) { this.postMsgOnceAlive({ command: "reveal frameIdx", frameIdx: idx }); }
                    });
                }
            }
            if (ev.timeSyncs?.length && this._timeSyncEvents.length) {
                console.log(` got ${ev.timeSyncs.length} timeSyncs from ${ev.uri.toString()}`);
                let adjustTimeBy: number[] = [];
                let reBroadcastEvents: TimeSyncData[] = [];

                // compare with our known timesyncs.
                for (let i = 0; i < ev.timeSyncs.length; ++i) {
                    const remoteSyncEv = ev.timeSyncs[i];
                    console.log(`  got id='${remoteSyncEv.id}' with value='${remoteSyncEv.value} at ${remoteSyncEv.time.toLocaleTimeString()}`);
                    // do we have this id? (optimize with maps... for now linear (search))
                    for (let j = 0; j < this._timeSyncEvents.length; ++j) {
                        const localSyncEv = this._timeSyncEvents[j];
                        if (remoteSyncEv.id === localSyncEv.id) {
                            console.log(`  got id='${remoteSyncEv.id}' match. Checking value='${remoteSyncEv.value} at ${remoteSyncEv.time.toLocaleTimeString()}`);
                            if (remoteSyncEv.value === localSyncEv.value) {
                                console.log(`   got id='${remoteSyncEv.id}',prio=${remoteSyncEv.prio} and value='${remoteSyncEv.value} match at ${remoteSyncEv.time.toLocaleTimeString()}, prio=${localSyncEv.prio}`);
                                // todo! (what to do now? how to decide whether to adjust here (and not on the other side...))
                                // if the received prio is lower we adjust our time... // todo consider 3 documents...
                                // otherwise we broadcast all values with a lower prio than the current received ones...
                                if (remoteSyncEv.prio < localSyncEv.prio) {
                                    adjustTimeBy.push(remoteSyncEv.time.valueOf() - localSyncEv.time.valueOf());
                                } else if (remoteSyncEv.prio > localSyncEv.prio) {
                                    reBroadcastEvents.push(localSyncEv);
                                }
                            }
                        }
                    }
                }
                let adjustedTime: boolean = false;
                if (adjustTimeBy.length) {
                    const minAdjust = Math.min(...adjustTimeBy);
                    const maxAdjust = Math.max(...adjustTimeBy);
                    const avgAdjust = adjustTimeBy.reduce((a, b) => a + b, 0) / adjustTimeBy.length;
                    console.log(`have ${adjustTimeBy.length} time adjustments with min=${minAdjust}, max=${maxAdjust}, avg=${avgAdjust} ms.`);
                    if (Math.abs(avgAdjust) > 100) {
                        this.gotTimeSyncEvents = true;
                        this.adjustTime(avgAdjust);
                        adjustedTime = true;
                    }
                }
                if (reBroadcastEvents.length && !adjustedTime) {
                    console.log(`re-broadcasting ${reBroadcastEvents.length} time syncs via onDidChangeSelectedTime`);
                    this._onDidChangeSelectedTime.fire({ time: new Date(0), uri: this.uri, timeSyncs: reBroadcastEvents });
                }

            }
        }
    }

    getColumnIdx(columnStr: string): number | undefined {
        const res = this._sharkd2Info;
        if (res === undefined) { return undefined; }
        const ws_d_columns = res['columns'];
        for (var col_map = 0; col_map < ws_d_columns.length; col_map++) {
            if (ws_d_columns[col_map].format === columnStr) {
                return col_map;
            }
        }
        return undefined;
    }

    async onDidChangeConfiguration(ev: vscode.ConfigurationChangeEvent) {
        const affected: boolean = ev.affectsConfiguration("vsc-webshark");
        console.log(`WebsharkView.onDidChangeConfiguration vsc-webshark. affected=${affected}`);
        if (affected) {
            if (ev.affectsConfiguration("vsc-webshark.events") && this._firstInfosLoaded) {
                this.scanForEvents();
            }
            if (ev.affectsConfiguration("vsc-webshark.columns") || ev.affectsConfiguration("vsc-webshark.columnsWidths")) {
                const configColumns = <any[]>(vscode.workspace.getConfiguration().get("vsc-webshark.columns"));
                const configColumnsWidths = <any>(vscode.workspace.getConfiguration().get("vsc-webshark.columnsWidths"));
                this.onConfigColumnsChange(configColumns, configColumnsWidths);
            }
        }
    }

    adjustTime(relOffsetMs: number) {
        this._timeAdjustMs += relOffsetMs;
        console.log(`WebsharkView.adjustTime(${relOffsetMs}) to new offset: ${this._timeAdjustMs}`);

        // adjust timeSyncs: as they contain pre-calculated times
        this._timeSyncEvents.forEach((syncData) => {
            syncData.time = new Date(syncData.time.valueOf() + relOffsetMs);
        });

        // and broadcast the new times again
        this.broadcastTimeSyncs();

        // we might send this time to the webview and store it there for next session persistency? todo
    }

    broadcastTimeSyncs() {
        if (this._timeSyncEvents.length) {
            console.log(`broadcasting ${this._timeSyncEvents.length} time syncs via onDidChangeSelectedTime`);
            this._onDidChangeSelectedTime.fire({ time: new Date(0), uri: this.uri, timeSyncs: this._timeSyncEvents });
        }
    }

    async scanForEvents() {

        this._timeSyncEvents = [];
        this._eventsNode.children = [];
        this._treeViewProvider.updateNode(this._eventsNode);

        // as we scan with multiple scans/filter for the events but want them sorted by frame-number (=time)
        // we push them to here and sort into the eventsNode.children at the end
        let eventsUnsorted: { num: number, level: number, node: TreeViewNode }[] = [];

        // do we have events defined?
        const events = vscode.workspace.getConfiguration().get<Array<any>>("vsc-webshark.events");
        console.log(`WebsharkView.scanForEvents have ${events?.length} events`);
        if (events && events.length) {
            let infoColumnIdx = this.getColumnIdx('%i'); // what if this doesn't exist?

            for (let i = 0; i < events.length; ++i) {
                const event = events[i];
                console.log(`WebsharkView.scanForEvents  processing event ${JSON.stringify(event)}`);
                // some sanity checks:
                if (event.displayFilter?.length > 0) {
                    let req: any = { // todo make limit configurable or remove
                        req: 'frames', limit: 5000, filter: event.displayFilter, column0: this._utcTimeColumnIdx,
                        column1: infoColumnIdx
                    };
                    // add values to column2,...
                    if (event.values !== undefined && Array.isArray(event.values)) {
                        for (let v = 0; v < event.values.length; v++) {
                            req[`column${v + 2}`] = event.values[v];
                        }
                    }
                    this.sharkd2Request(req, (reqRes: any) => {
                        if ('error' in reqRes) {
                            console.warn(`WebsharkView sharkd2 'frames' got error=${JSON.stringify(reqRes)}`);
                        } else {
                            const res = reqRes.result;
                            console.log(`WebsharkView sharkd2 scan event #'${i}' got ${res.length} frames  res=${JSON.stringify(res).slice(0, 1000)}`);
                            // by default we convert values by concating with ' '
                            var convValuesFunction: Function = (arr: Array<string>) => { return arr.join(' '); };
                            // but we can specify that as well:
                            if (event.conversionFunction !== undefined) {
                                convValuesFunction = Function("values", event.conversionFunction);
                                console.warn(` using conversionFunction = '${convValuesFunction}'`);
                            }

                            for (let e = 0; e < res.length; ++e) {
                                try {
                                    const frame = res[e];
                                    if (event.level > 0) {
                                        // determine label:
                                        let label: string = event.label !== undefined ? stringFormat(event.label, frame.c.slice(1)) : frame.c[1];
                                        const node = new TreeViewNode(label, this._eventsNode);
                                        node.time = new Date(frame.c[0]); // without timeadjust. we do this onDidChangeSelection... for now
                                        eventsUnsorted.push({ num: frame.num, level: event.level, node: node });
                                    }
                                    if (event.timeSyncId?.length > 0 && event.timeSyncPrio > 0) {
                                        // store as timeSync
                                        let timeSyncValue: string = frame.c.length > 2 ? (convValuesFunction(frame.c.slice(2)) /*frame.c.slice(2).join(' ')*/) : frame.c[1];
                                        // not needed with conversionFunction timeSyncValue = timeSyncValue.toLowerCase();
                                        let time = new Date(new Date(frame.c[0]).valueOf() + this._timeAdjustMs);
                                        console.log(`WebsharkView sharkd2 scan event #'${i}' got timeSync '${event.timeSyncId}' with value '${timeSyncValue}'`);
                                        this._timeSyncEvents.push({ id: event.timeSyncId, value: timeSyncValue, prio: event.timeSyncPrio, time: time });
                                    }
                                } catch (err) {
                                    console.error(`WebsharkView sharkd2 scan event #'${i}' got error '${err}' with idx '${e}'`);
                                }
                            }
                            console.log(`WebsharkView sharkd2 scan event #'${i}' finished got ${res.length} frames`);
                            // todo move at the end... use proper Promise and wait for all to finish...
                            if (i === events.length - 1) {
                                // now sort the eventsUnsorted by num first:
                                eventsUnsorted.sort((a, b) => a.num - b.num);
                                // then move to proper level:

                                const getParent = (level: number): TreeViewNode => {
                                    if (level === 1) {
                                        return this._eventsNode;
                                    } else {
                                        const parent = getParent(level - 1);
                                        if (parent.children.length === 0) {
                                            // create a dummy and return that one:
                                            parent.children.push(new TreeViewNode(`(no parent level ${level - 1} event)`, parent));
                                        }
                                        return parent.children[parent.children.length - 1];
                                    }
                                };

                                for (let j = 0; j < eventsUnsorted.length; ++j) {
                                    const ev = eventsUnsorted[j];
                                    const parentNode = getParent(ev.level);
                                    parentNode.children.push(ev.node);
                                }

                                vscode.window.showInformationMessage(`finished scanning for events. found ${eventsUnsorted.length}`); // put into status bar item todo
                                this._treeViewProvider.updateNode(this._eventsNode);
                                this.broadcastTimeSyncs();
                            }
                        }
                    });
                } else {
                    console.warn(`WebsharkView.scanForEvents   event missing displayFilter: ${JSON.stringify(event)}`);
                }
            }
        }

    }

    async adjustTimeReq(e: any) {
        let curAdjustMs: number = this._timeAdjustMs;
        const time: Date = new Date(new Date(e.time).valueOf() + curAdjustMs);
        console.log(`WebsharkView 'adjust time req' frame=${e.frame} time=${time.toUTCString()}`);
        // check first whether we shall use the last received time event?
        // we do this only if we didn't receive any timeSyncs (assuming that the next one will auto update anyhow so it makes no sense to change man.)
        let doManualPrompt = true;
        if (!this.gotTimeSyncEvents && this.lastSelectedTimeEv) {
            if (time) {
                // calc adjust value:
                let selTimeAdjustValue = this.lastSelectedTimeEv.valueOf() - time.valueOf();
                let response: string | undefined =
                    await vscode.window.showInformationMessage(`Adjust based on last received time event (adjust by ${selTimeAdjustValue / 1000} secs)?`,
                        { modal: true }, "yes", "no");
                if (response === "yes") {
                    doManualPrompt = false;
                    this.adjustTime(selTimeAdjustValue);
                } else if (!response) {
                    doManualPrompt = false;
                }
            }

        }
        if (doManualPrompt) {
            vscode.window.showInputBox({ prompt: `Enter new time adjust in secs (cur = ${curAdjustMs / 1000}):`, value: (curAdjustMs / 1000).toString() }).then(async (value: string | undefined) => {
                if (value) {
                    let newAdjustMs: number = (+value) * 1000;
                    this.adjustTime(newAdjustMs - curAdjustMs); // here we want the entered value to become the new abs value
                }
            });
        }
    }
}

function stringFormat(str: string, args: Array<string>): string {
    return str.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] !== 'undefined'
            ? args[number]
            : match
            ;
    });
}
