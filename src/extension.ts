// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { FoldTree, languageCommentMap } from './foldtree';
import { Logger } from './logger';



const traceLevels: { [key: string]: string } = {
    "t1": "error!",
    "t2": "warn!",
    "t3": "info!",
    "t4": "debug!",
    "t5": "trace!"
};


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    Logger.init();
    Logger.info('Congratulations, your extension "topohedral-vscode" is now active!');
    let state = new TopoHedralVscodeState();

    {
        Logger.info('adding onDidOpenTextDocument handler');
        let disposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (documentOk(document)) {
                Logger.info('onDidOpenTextDocument handler called for ' + document.uri.toString());
                Logger.info('is of type ' + document.languageId);
                Logger.info('creating new fold tree for' + document.uri.toString());
                state.createFoldTree(document);
                await vscode.commands.executeCommand("vscode.executeFoldingRangeProvider", document.uri);
            }
        });
        context.subscriptions.push(disposable);
    }

    {
        Logger.info('adding onDidCloseTextDocument handler');
        let disposable = vscode.workspace.onDidCloseTextDocument((document) => {
            if (documentOk(document)) {
                Logger.info('onDidCloseTextDocument handler called');
                Logger.info('is of type ' + document.languageId);
                state.deleteFoldTree(document);
            }
        });
        context.subscriptions.push(disposable);
    }

    {
        Logger.info('adding onDidChangeTextDocument handler');
        let disposable = vscode.workspace.onDidChangeTextDocument((event) => {

            if (documentOk(event.document)) {
                Logger.info('onDidChangeTextDocument handler called for ' + event.document.uri.toString());
                Logger.info('Rebuilding fold tree for ' + event.document.uri.toString());
                state.rebuildFoldTree(event.document);
            }
        });
        context.subscriptions.push(disposable);
    }

    // .............................. commands
    {
        Logger.info('Registering topohedral-vscode.addFold');
        let disposable = vscode.commands.registerCommand('topohedral-vscode.addFold', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && documentOk(editor.document)) {
                Logger.info("Adding fold for file " + editor.document.uri.toString());
                state.addFold();
            }
        });
        context.subscriptions.push(disposable);
    }

    {
        Logger.info('Registering topohedral-vscode.removeFold');
        let disposable = vscode.commands.registerCommand('topohedral-vscode.removeFold', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && documentOk(editor.document)) {
                Logger.info("Removing fold for file " + editor.document.uri.toString());
                state.removeFold();
            }
        });
        context.subscriptions.push(disposable);
    }


    {
        Logger.info("Registering topohedral-vscode.copyFold");
        let disposable = vscode.commands.registerCommand('topohedral-vscode.copyFold', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && documentOk(editor.document)) {
                Logger.info("Copying fold for file " + editor.document.uri.toString());
                state.copyFold();
            }
        });
    }

    {
        Logger.info("Registering topohedral-vscode.cutFold");
        let disposable = vscode.commands.registerCommand('topohedral-vscode.cutFold', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && documentOk(editor.document)) {
                Logger.info("Cutting fold for file " + editor.document.uri.toString());
                state.cutFold();
            }
        });
    }
    {
        Logger.info("Registering topohedral-vscode.insertTraceFold");
        let disposable = vscode.commands.registerCommand("topohedral-vscode.insertTraceFold", async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && documentOk(editor.document)) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }
                Logger.info("Inserting trace fold for file " + editor.document.uri.toString());
                if (editor.selection.isEmpty) {
                    const line = editor.document.lineAt(editor.selection.start.line);
                    const indentation = getIndentation(line);
                    const line_str = line.text.trim();
                    const traceCommand = traceLevels[line_str];
                    if (traceCommand) {
                        const insideTraceFold = await state.insideTraceFold();
                        if (insideTraceFold) {
                            const line_num = line.range.start.line;
                            const col_num = indentation.length + traceCommand.length + 2;

                            editor.edit((editBuilder) => {
                                editBuilder.replace(line.range, `${indentation}${traceCommand}("")`);
                            }).then(() => {
                                const newPos = new vscode.Position(line_num, col_num);
                                editor.selection = new vscode.Selection(newPos, newPos);
                            });
                        }
                        else {

                            const line_num = line.range.start.line + 1;
                            const col_num = indentation.length + traceCommand.length + 2;

                            editor.edit((editBuilder) => {
                                editBuilder.replace(line.range,
                                    `${indentation}//{{{ trace\n${indentation}${traceCommand}("")\n${indentation}//}}}`);
                            }).then(() => {
                                const newPos = new vscode.Position(line_num, col_num);
                                editor.selection = new vscode.Selection(newPos, newPos);
                            });
                        }
                    }
                }
            }
        });
    }

    {
        Logger.info("Registering topohedral-vcode.rebuildTree");
        let disposable = vscode.commands.registerCommand("topohedral-vscode.rebuildTree", async () => {

            const editor = vscode.window.activeTextEditor;
            if (editor && documentOk(editor.document)) {
                Logger.info("Rebuilding tree for " + editor.document.uri.toString());
                state.rebuildFoldTree(editor.document);
                await vscode.commands.executeCommand("vscode.executeFoldingRangeProvider", editor.document.uri);
            }
        });
    }


    {
        Logger.info("Registering topohedral-vscode.newRustFile");
        let disposable = vscode.commands.registerCommand("topohedral-vscode.newRustFile", async () => {
            const newDocument = await vscode.workspace.openTextDocument({ language: 'rust' });
            const editor = await vscode.window.showTextDocument(newDocument);
            const startSnippet = await getSnippet(context, "modpreamble");
            const startSnippetObj = new vscode.SnippetString(startSnippet);
            await editor.insertSnippet(startSnippetObj, new vscode.Position(0, 0));

            let nLines = newDocument.lineCount;

            await editor.edit(editBuilder => {
                for (let i = 0; i < 10; ++i) {
                    editBuilder.insert(new vscode.Position(nLines, 0), "\n");
                }
            });

            nLines = newDocument.lineCount;
            const testModSnippet = await getSnippet(context, "testmod");
            const testModSnippetObj = new vscode.SnippetString(testModSnippet);
            await editor.insertSnippet(testModSnippetObj, new vscode.Position(nLines - 1, 0));
        });
    }

    // .............................. folding provider 
    Logger.info('Registerig the folding provider');
    Object.keys(languageCommentMap).forEach(language => {
        Logger.info('Registering folding provider for ' + language);
        const disposableFolding = vscode.languages.registerFoldingRangeProvider(
            { scheme: 'file', language }, state
        );
        context.subscriptions.push(disposableFolding);
    });
}
//..................................................................................................

// This method is called when your extension is deactivated
export function deactivate() { }
//..................................................................................................

function documentOk(document: vscode.TextDocument): boolean {
    return document.uri.scheme !== 'output' && document.languageId in languageCommentMap;
}
//..................................................................................................

async function getSnippet(context: vscode.ExtensionContext, snippetId: string): Promise<string> {

    const filePath = path.join(context.extensionPath, 'snippets', 'rust.json');

    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                const snippetsJson = JSON.parse(data);
                const snippet = snippetsJson[snippetId];
                let snippetText = "";
                if (snippet) {
                    snippetText = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
                    resolve(snippetText);
                }
                else {
                    reject("Snippet does not exist");
                }
            } catch (err) {
                reject(err);
            }
        });
    });
}

function getIndentation(line: vscode.TextLine): string {
    const indent = line.text.match(/^\s*/)?.[0] || '';
    return indent;
}


class TopoHedralVscodeState implements vscode.FoldingRangeProvider {
    private foldTrees: Map<string, FoldTree> = new Map();


    /**
     * Provides the folding ranges for the given text document.
     *
     * This method is called by the VS Code editor to retrieve the folding ranges
     * for the provided text document. It iterates through the fold tree associated
     * with the document and creates a list of `FoldingRange` objects representing
     * the foldable regions in the document.
     *
     * @param document - The text document for which to provide the folding ranges.
     * @param context - Additional context information about the folding request.
     * @param token - A cancellation token that can be used to cancel the folding range request.
     * @returns An array of `FoldingRange` objects representing the foldable regions in the document.
     */
    provideFoldingRanges(document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken)
        : vscode.FoldingRange[] | Thenable<vscode.FoldingRange[]> {
        let tstart = performance.now();
        const ranges: vscode.FoldingRange[] = [];

        Logger.info('provideFoldingRanges called for ' + document.uri.toString());
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree) {
            const nodeRanges = foldTree.nodeRanges();
            for (const [start, end] of nodeRanges) {
                const foldingRange = new vscode.FoldingRange(start, end, vscode.FoldingRangeKind.Region);
                ranges.push(foldingRange);
            }
        }

        let tend = performance.now();
        let elapsed = tend - tstart;
        Logger.info(`provideFoldingRanges: ${elapsed}`);
        return ranges;
    }
    //..............................................................................................

    async insideTraceFold() {

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            return;
        }

        let insideTrace = false;
        if (editor.selection.isEmpty) {
            const line = editor.selection.active.line;
            const node = this.foldTrees.get(editor.document.uri.toString())?.nodeAt(line);
            insideTrace = node?.title === 'trace';
        }
        return insideTrace;
    }
    //..............................................................................................

    /**
     * Adds a fold marker around the selected code block.
     *
     * This method is called when the user wants to add a fold marker around a selected
     * code block. It first determines the start and end lines of the selection, then
     * inserts the appropriate fold marker comments at the beginning and end of the
     * selected block. The indentation of the fold markers matches the indentation of
     * the first and last lines of the selected block.
     */
    async addFold() {

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            return;
        }

        const document = editor.document;
        const languageId = document.languageId;
        const commentSymbols = languageCommentMap[languageId] || { start: "", end: "" };

        let startLine = 0;
        let endLine = 0;

        if (editor.selection.isEmpty) {
            const pos = editor.selection.active;
            const ra = new vscode.Range(pos, pos.translate(0, 1));
            const charAtPos = document.getText(ra);
            if (charAtPos === "{" || charAtPos === "}") {
                await vscode.commands.executeCommand("editor.action.jumpToBracket");
                const pos2 = editor.selection.active;
                startLine = Math.min(pos.line, pos2.line);
                endLine = Math.max(pos.line, pos2.line);

            }
            else {
                startLine = editor.selection.start.line;
                endLine = editor.selection.end.line;
            }
        }
        else {
            startLine = editor.selection.start.line;
            endLine = editor.selection.end.line;

        }

        const startIndentation = getIndentation(document.lineAt(startLine));
        const startFold = `${startIndentation}${commentSymbols.start}{{{ \n`;
        const endFold = `${startIndentation}${commentSymbols.start}}}}\n`;

        editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(endLine + 1, 0), endFold);
            editBuilder.insert(new vscode.Position(startLine, 0), startFold);
        }).then(() => {
            const colNum = startIndentation.length + commentSymbols.start.length + 4;
            const newPos = new vscode.Position(startLine, colNum);
            editor.selection = new vscode.Selection(newPos, newPos);
        });
    }
    //..............................................................................................

    /**
     * Removes a fold from the active text editor.
     * 
     * This method checks if the active text editor has a selection, and if the selection is empty. 
     * If so, it retrieves the fold tree for the current document and finds the fold node at the 
     * cursor position. If the cursor is at the start or end of the fold, the method deletes the 
     * fold by removing the start and end fold markers from the document.
     */
    async removeFold() {

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            return;
        }

        const document = editor.document;
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line === node.start) || (pos.line === node.end))) {
                const startLineLen = document.lineAt(node.start).text.length;
                const endLineLen = document.lineAt(node.end).text.length;
                const range1 = new vscode.Range(node.start, 0, node.start, startLineLen);
                const range2 = new vscode.Range(node.end, 0, node.end, startLineLen);
                await editor.edit(editBuilder => {
                    editBuilder.delete(range2);
                    editBuilder.delete(range1);
                });
            }
        }
    }
    //..............................................................................................

    /**
     * Deletes a fold from the active text editor.
     * 
     * This method checks if the active text editor has a selection, and if the selection is empty. 
     * If so, it retrieves the fold tree for the current document and finds the fold node at the 
     * cursor position. If the cursor is at the start or end of the fold, the method deletes the 
     * fold by removing the start and end fold markers from the document.
     */
    async deleteFold() {

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            return;
        }

        const document = editor.document;
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line === node.start) || (pos.line === node.end))) {
                const startLineLen = document.lineAt(node.start).text.length;
                const endLineLen = document.lineAt(node.end).text.length;
                const range1 = new vscode.Range(node.start, 0, node.start, startLineLen);
                const range2 = new vscode.Range(node.end, 0, node.end, startLineLen);
                await editor.edit(editBuilder => {
                    editBuilder.delete(range2);
                    editBuilder.delete(range1);
                });
            }
        }
    }
    //..............................................................................................

    /**
     * Copies the text of the current fold to the clipboard.
     *
     * This method checks if there is an active editor and a fold tree associated with the current 
     * document. If so, and the * editor's selection is empty, it retrieves the fold node at the 
     * current cursor position. If the cursor is at the * start of the fold, it copies the text 
     * of the entire fold to the clipboard.
     */
    async copyFold() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line === node.start))) {
                const endLineLen = document.lineAt(node.end).text.length;
                const range = new vscode.Range(node.start, 0, node.end, endLineLen);
                await vscode.env.clipboard.writeText(document.getText(range));
            }
        }
    }
    //..............................................................................................

    /**
     * Cuts the text of the current fold and copies it to the clipboard.
     *
     * This method checks if there is an active editor and a fold tree associated with the current document. If so, and the
     * editor's selection is empty, it retrieves the fold node at the current cursor position. If the cursor is at the
     * start of the fold, it copies the text of the entire fold to the clipboard and then deletes the fold from the document.
     */
    async cutFold() {

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line === node.start))) {
                const endLineLen = document.lineAt(node.end).text.length;
                const range = new vscode.Range(node.start, 0, node.end, endLineLen);
                await vscode.env.clipboard.writeText(document.getText(range));
                await editor.edit(editBuilder => {
                    editBuilder.delete(range);
                });
            }
        }
    }
    //..............................................................................................

    /**
     * Creates a new FoldTree instance for the given text document.
     *
     * This method iterates through the lines of the document, collects the text
     * of each line, and creates a new FoldTree instance with the collected content
     * and the document's language ID. The created FoldTree is then stored in the
     * `foldTrees` map, using the document's URI as the key.
     *
     * @param document - The text document for which to create the FoldTree.
     */
    createFoldTree(document: vscode.TextDocument) {
        let t1 = performance.now();

        let content: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            content.push(document.lineAt(i).text);
        }

        let newFoldTree = new FoldTree(content, document.languageId);
        Logger.info('new fold tree created for \n' + document.uri.toString());
        this.foldTrees.set(document.uri.toString(), new FoldTree(content, document.languageId));

        let t2 = performance.now();
        let elapsed = t2 - t1;
        Logger.info(`createFoldTree: ${elapsed}`);
    }
    //..............................................................................................

    /**
     * Deletes the fold tree for the given document.
     *
     * This method removes the fold tree associated with the provided document from the internal
     * `foldTrees` map. This is useful when the document is closed or the extension is deactivated,
     * to free up memory and resources associated with the fold tree.
     *
     * @param document - The text document for which the fold tree should be deleted.
     */
    deleteFoldTree(document: vscode.TextDocument) {
        let t1 = performance.now();
        Logger.info(`Deleting fold tree for ${document.uri.toString()}`);
        this.foldTrees.delete(document.uri.toString());

        let t2 = performance.now();
        let elapsed = t2 - t1;
        Logger.info(`deleteFoldTree: ${elapsed}`);
    }
    //..............................................................................................

    rebuildFoldTree(document: vscode.TextDocument) {
        let t1 = performance.now();
        Logger.info(`Rebuilding fold tree for ${document.uri.toString()}`);
        this.deleteFoldTree(document);
        this.createFoldTree(document);
    }
    //..............................................................................................
}
//..................................................................................................

