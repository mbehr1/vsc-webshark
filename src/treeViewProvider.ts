/* --------------------
 * Copyright(C) Matthias Behr, 2020.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { timingSafeEqual } from 'crypto';

let _nextUniqueId: number = 1;
function createUniqueId(): string {
    const toRet = _nextUniqueId.toString();
    _nextUniqueId++;
    return toRet;
}

export class TreeViewNode {
    id: string; // unique id
    label: string;
    uri: vscode.Uri | null = null; // index provided as fragment #<index>
    parent: TreeViewNode | null;
    children: TreeViewNode[] = [];
    contextValue?: string;
    command?: vscode.Command;

    constructor(label: string, parent: TreeViewNode | null) {
        this.id = createUniqueId();
        this.label = label;
        this.parent = parent;
    }
};

export class TreeViewProvider implements vscode.TreeDataProvider<TreeViewNode>, vscode.Disposable {

    public treeRootNodes: TreeViewNode[] = [];
    private _onDidChangeTreeData: vscode.EventEmitter<TreeViewNode | null> = new vscode.EventEmitter<TreeViewNode | null>();
    readonly onDidChangeTreeData: vscode.Event<TreeViewNode | null> = this._onDidChangeTreeData.event;
    public treeView: vscode.TreeView<TreeViewNode> | undefined = undefined;

    public updateNode(node: TreeViewNode | null, reveal: boolean = false, updateParent: boolean = false) {
        if (updateParent && node) { this._onDidChangeTreeData.fire(node.parent); }
        this._onDidChangeTreeData.fire(node);
        if (reveal && node !== null && this.treeView !== undefined) {
            // console.log(`TreeViewProvider.updateNode revealing`);
            this.treeView!.reveal(node, { select: false, focus: false, expand: true }); // todo make options accessible
        }
    }

    public getTreeItem(element: TreeViewNode): vscode.TreeItem {
        // console.log(`dlt-logs.getTreeItem(${element.label}, ${element.uri?.toString()}) called.`);
        return {
            id: element.id,
            // uri?
            label: element.label.length ? element.label : "<treeview empty>",
            contextValue: element.contextValue,
            command: element.command,
            collapsibleState: element.children.length ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
            iconPath: /* (element.children.length === 0 && element.label.startsWith("xy")) ? path.join(__filename, '..', '..', 'media', 'root-folder.svg') : */ undefined // todo!
        };
    }
    public getChildren(element?: TreeViewNode): TreeViewNode[] | Thenable<TreeViewNode[]> {
        // console.log(`dlt-logs.getChildren(${element?.label}, ${element?.uri?.toString()}) this=${this} called (#treeRootNode=${this._treeRootNodes.length}).`);
        if (!element) { // if no element we have to return the root element.
            // console.log(`dlt-logs.getChildren(undefined), returning treeRootNodes`);
            return this.treeRootNodes;
        } else {
            // console.log(`dlt-logs.getChildren(${element?.label}, returning children = ${element.children.length}`);
            return element.children;
        }
    }

    public getParent(element: TreeViewNode): vscode.ProviderResult<TreeViewNode> {
        // console.log(`dlt-logs.getParent(${element.label}, ${element.uri?.toString()}) = ${element.parent?.label} called.`);
        return element.parent;
    }

    dispose() {
        console.log(`TreeViewProvider.dispose called...`);
    }
}