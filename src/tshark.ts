/* --------------------
 * Copyright(C) Matthias Behr, 2020 - 2024.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

let _nextTSharkdId = 1;

const platformWin32: boolean = process.platform === "win32";
const separator = platformWin32 ? '"' : "'"; // win cmd uses ", unix sh uses '

function escapeShellChars(aString: string): string {
    if (platformWin32) { // < > ( ) & | , ; " escape with ^
        // for now not escape & | " 
        return aString.replace(/\<|\>|\(|\),/g, '^$&');
    } else { // for now we dont escape as the display filter is already within single quotes
        return aString;
    }
}

function getTsharkFullPath(): string {
    const confTshark = vscode.workspace.getConfiguration().get<string>('vsc-webshark.tsharkFullPath');
    const tsharkFullPath: string = confTshark ? confTshark : 'tshark';
    return tsharkFullPath;
}

function getMergecapFullPath(): string {
    const confMergecap = vscode.workspace.getConfiguration().get<string>('vsc-webshark.mergecapFullPath');
    if (confMergecap) {
        return confMergecap;
    } else {
        // lets provide a better default with the tshark path:
        const confTshark = vscode.workspace.getConfiguration().get<string>('vsc-webshark.tsharkFullPath');
        return confTshark ? path.join(path.dirname(confTshark), 'mergecap') : 'mergecap';
    }
}

export class TSharkProcess implements vscode.Disposable {
  private _tsharkPath: string = getTsharkFullPath();
  private _mergecapPath: string = getMergecapFullPath();
  public id: number;
  private _proc: ChildProcess;
  public running: boolean = false;
  public lastError: Error | undefined;
  private _donePromises: ((value: number) => void)[] = [];
  private _spawnedShell: boolean = false;

  private _onDataFunction: null | ((data: Buffer) => void);

  constructor(
    tsharkArgs: ReadonlyArray<ReadonlyArray<string>>,
    onDataFunction: (data: Buffer) => void,
    private _inFiles: readonly string[] = [],
    private _outFile: string = ''
  ) {
    this.id = _nextTSharkdId++;
    this._onDataFunction = onDataFunction;
    //const { base: sharkdCmd, dir: sharkdDirParsed } = path.parse(this._tsharkPath);
    //const sharkdDir = sharkdDirParsed.length > 0 ? sharkdDirParsed : process.cwd();
    // todo seems not needed here? (test...)
    console.log(`spawning ${this._tsharkPath} from cwd=${process.cwd()} win32=${platformWin32}`);

    if (tsharkArgs.length < 1) {
      throw Error('tharkArgs.length <1');
    }

    // we should not modify the args. so let's make a deep copy first:
    let localTsharkArgs: string[][] = [];
    for (let i = 0; i < tsharkArgs.length; ++i) {
      const innerArr = tsharkArgs[i];
      // do we need to do any escaping of shell chars?
      const newInnerArr = [...innerArr].map((e) => escapeShellChars(e));
      localTsharkArgs.push(newInnerArr);
    }

    const haveMultipleInFiles: boolean = _inFiles.length > 1;

    if (_inFiles.length === 1) {
      localTsharkArgs[0].unshift(`-r ${separator}${_inFiles[0]}${separator}`);
    }
    if (_outFile.length) {
      localTsharkArgs[localTsharkArgs.length - 1].push(`-w ${separator}${_outFile}${separator}`);
    }

    if (localTsharkArgs.length > 1 || haveMultipleInFiles) {
      // we have more than one process that we'd like to pipe the output to
      const command: string = platformWin32 ? 'cmd' : 'sh';
      const args: string[] = [`${platformWin32 ? '/s /c' : '-c'}`];
      this._spawnedShell = true;

      // add pipe support for the interims ones:
      let longArg: string = '"';

      // for multiple in files we first pass via mergecap:
      if (haveMultipleInFiles) {
        longArg += `${separator}${this._mergecapPath}${separator} -w -`;
        for (let f = 0; f < _inFiles.length; ++f) {
          longArg += ` ${separator}${_inFiles[f]}${separator}`;
        }
        longArg += `|`;
        console.log(`spawning ${longArg} for ${_inFiles.length} multiple files`);
      }

      for (let i = 0; i < localTsharkArgs.length; ++i) {
        longArg += `${separator}${this._tsharkPath}${separator} `;
        if (i > 0 || haveMultipleInFiles) {
          longArg += `-r - `;
        }
        longArg += localTsharkArgs[i].join(' ');
        if (i < localTsharkArgs.length - 1) {
          longArg += ` -w -|`;
        }
      }
      longArg += '"';
      args.push(longArg);

      console.log(`spawning ${command} from cwd=${process.cwd()} win32=${platformWin32} args:`);
      for (let i = 0; i < args.length; ++i) {
        console.log(` ${args[i]}`);
      }

      this._proc = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        windowsVerbatimArguments: platformWin32 ? true : false,
        detached: !platformWin32,
      });
    } else {
      // single args. spawn directly
      console.log(`spawning ${this._tsharkPath} from cwd=${process.cwd()} win32=${platformWin32} args:`);
      for (let i = 0; i < localTsharkArgs[0].length; ++i) {
        console.log(` ${localTsharkArgs[0][i]}`);
      }

      this._proc = spawn(`${separator}${this._tsharkPath}${separator}`, localTsharkArgs[0], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        windowsVerbatimArguments: platformWin32 ? true : false,
      });
    }

    this.running = true;
    this._proc.on('error', (err) => {
      console.warn(`TsharkProcess(${this.id}) got error: ${err}`);
      this.running = false;
      this.lastError = err;
      this._donePromises.forEach((p) => p(-1));
      this._donePromises = [];
    });
    this._proc.on('close', (code) => {
      console.log(`TsharkProcess(${this.id}) closed with: ${code}`);
      this.running = false;
      this._donePromises.forEach((p) => p(code || 0));
      this._donePromises = [];
    });
    this._proc.stderr?.on('data', (data) => {
      const strData: string = data.toString();
      console.log(`TsharkProcess(${this.id}) stderr: '${strData}'`);
      if (this.running) {
        vscode.window.showWarningMessage(`tshark got stderr: '${strData}'`);
      }
    });
    this._proc.stdout?.on('data', (data: Buffer) => {
      //console.log(`TsharkProcess(${this.id}) got data len=${data.length} '${data.slice(0, 70).toString()}'`);
      if (this._onDataFunction) {
        this._onDataFunction(data);
      }
    });
  }

  dispose() {
    console.log(
      `TSharkProcess(${this.id}).dispose() called.(killed=${this._proc.killed}) spawnedShell=${this._spawnedShell} running=${this.running}`
    );
    if (this.running) {
      if (this._spawnedShell && !platformWin32) {
        try {
          if (this._proc.pid !== undefined) {
            process.kill(-this._proc.pid, 'SIGINT'); // this is a bit more picky with not running processes
          }
        } catch (err) {
          console.log(`TSharkProcess(${this.id}).dispose() process.kill got err=${err}`);
        }
      } else {
        if (platformWin32) {
          // we start all with shell so need to kill the full tree:
          spawn('taskkill', ['/pid', `${this._proc.pid}`, '/f', '/t']);
        } else {
          this._proc.kill(); // send SIGTERM
        }
      }
      this.running = false;
    }
  }

  done(): Promise<number> {
    return new Promise<number>((resolve) => {
      if (!this.running) {
        resolve(this.lastError !== undefined ? -1 : 0);
        return;
      }
      this._donePromises.push(resolve);
    });
  }
}

export class TSharkDataProvider implements vscode.Disposable {
  private _onDidChangeData: vscode.EventEmitter<string[]> = new vscode.EventEmitter<string[]>();
  readonly onDidChangeData: vscode.Event<string[]> = this._onDidChangeData.event;

  private _tshark: TSharkProcess;
  private _partialLine: string = '';

  constructor(tsharkArgs: ReadonlyArray<ReadonlyArray<string>>, private _inFiles: readonly string[] = [], private _outFile: string = '') {
    this._tshark = new TSharkProcess(tsharkArgs, this.onData.bind(this), _inFiles, _outFile);
  }

  done(): Promise<number> {
    return this._tshark.done();
  }

  private onData(data: Buffer): void {
    const lines = data.toString().split(platformWin32 ? /\r\n/ : '\n');
    if (lines.length > 0) {
      // the first one we need to join with the partialLine
      if (this._partialLine.length > 0) {
        lines[0] = this._partialLine + lines[0];
        this._partialLine = '';
      }

      // the last one we use as partialLine (waiting for the \n)
      if (lines[lines.length - 1].endsWith('\n')) {
      } else {
        this._partialLine = lines[lines.length - 1];
        lines.pop();
      }
      if (lines.length > 0) {
        this._onDidChangeData.fire(lines);
      }
    }
  }

  dispose() {
    console.log(`TSharkDataProvider.dispose() called.`);
    this._tshark.dispose();
  }
}

export interface ListData {
  map: Map<string, any>;
}

export class TSharkListProvider implements vscode.Disposable {
  private _onDidChangeData: vscode.EventEmitter<ListData> = new vscode.EventEmitter<ListData>();
  readonly onDidChangeData: vscode.Event<ListData> = this._onDidChangeData.event;
  public data: ListData = { map: new Map<string, any>() };

  private _tshark: TSharkDataProvider;
  private _expectHeader: boolean = true; // for now we do always expect the query with -E header=y
  private _groupFn?: Function; // ((col0: string) => string);
  public headers: string[] = [];

  constructor(
    tsharkArgs: ReadonlyArray<ReadonlyArray<string>>,
    private _options: {
      valueMapper?: (key: string, value: string) => string[];
      groupBy?: { groupFn: string /*((col0: string) => string)*/; justOneValue?: boolean };
    } | null = null,
    private _inFiles: readonly string[] = [],
    private _outFile: string = ''
  ) {
    if (_options?.groupBy?.groupFn?.length) {
      this._groupFn = new Function('col0', _options.groupBy.groupFn);
      console.warn(`using groupFn=`, this._groupFn);
    }
    this._tshark = new TSharkDataProvider(tsharkArgs, _inFiles, _outFile);
    this._tshark.onDidChangeData(this.onData.bind(this));
  }

  onData(lines: string[]) {
    let didChange = false;
    // we do expect one, two or 3 data fields:
    // data like: f0:7f:0c:08:75:9f       160.48.199.66   0x0000010100a60000,0x0000100200a60000
    // first field will be used as key
    for (let i = 0; i < lines.length; ++i) {
      const parts = lines[i].split('\t');

      if (this._expectHeader) {
        this.headers = parts;
        this._expectHeader = false;
      } else {
        switch (parts.length) {
          case 1:
          case 2:
          case 3:
            {
              const group = this._groupFn ? this._groupFn(parts[0]) : parts[0];
              const dataSet = this.data.map.get(group);
              if (!dataSet) {
                let obj: any = {};
                // if we group by we do add a "_firstKey" with the orig value
                // this is used e.g. if we want to group by frame_epoch but need a real frame time as key
                if (this._groupFn) {
                  obj._firstKey = parts[0];
                }

                obj[this.headers.length > 0 ? this.headers[0] : 'f0'] = parts[0];
                if (parts.length >= 2) {
                  let key: string = this.headers.length > 1 ? this.headers[1] : 'f1';
                  let value: string = parts[1];
                  if (this._options?.valueMapper) {
                    [key, value] = this._options.valueMapper(key, value);
                  }
                  if (key.length > 0) {
                    obj[key] = [value];
                  }
                }
                if (parts.length >= 3) {
                  let key: string = this.headers.length > 2 ? this.headers[2] : 'f2';
                  let value: string = parts[2];
                  if (this._options?.valueMapper) {
                    [key, value] = this._options.valueMapper(key, value);
                  }
                  if (key.length > 0) {
                    obj[key] = [value];
                  }
                }
                this.data.map.set(group, obj);
                didChange = true;
              } else {
                if (!this._options?.groupBy?.justOneValue) {
                  if (parts.length >= 2) {
                    // check whether f1 contains parts1 already:
                    let key: string = this.headers.length > 1 ? this.headers[1] : 'f1';
                    let value: string = parts[1];
                    if (this._options?.valueMapper) {
                      [key, value] = this._options.valueMapper(key, value);
                    }
                    if (key.length > 0 && !dataSet[key].includes(value)) {
                      dataSet[key].push(value);
                      didChange = true;
                    }
                  }
                  if (parts.length >= 3) {
                    // check whether f2 contains parts2 already:
                    let key: string = this.headers.length > 2 ? this.headers[2] : 'f2';
                    let value: string = parts[2];
                    if (this._options?.valueMapper) {
                      [key, value] = this._options.valueMapper(key, value);
                    }
                    if (key.length > 0 && !dataSet[key].includes(value)) {
                      dataSet[key].push(value);
                      didChange = true;
                    }
                  }
                }
              }
            }
            break;
          default:
            // ignore
            break;
        }
      }
    }

    if (didChange) {
      this._onDidChangeData.fire(this.data);
    }
  }

  done(): Promise<number> {
    return this._tshark.done();
  }

  dispose() {
    console.log(`TSharkListProvider.dispose() called.`);
    this._tshark.dispose();
  }
}
