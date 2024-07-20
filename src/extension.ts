// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { FoldTree, languageCommentMap } from './foldtree';
import { Logger } from './logger';


function documentOk(document: vscode.TextDocument): boolean {
    return document.uri.scheme !== 'output' && document.languageId in languageCommentMap;
}

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
                await vscode.commands.executeCommand("executeFoldingRangeProvider", document.uri);
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
                state.rebuildFoldTree(event.document)

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

    // .............................. folding provider 
    Logger.info('Registernig the folding provider');
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
        let tstart = performance.now()
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

        let tend = performance.now()
        let elapsed = tend - tstart;
        Logger.info(`provideFoldingRanges: ${elapsed}`);
        return ranges;
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

        const document = editor.document
        const languageId = document.languageId;
        const commentSymbols = languageCommentMap[languageId] || { start: "", end: "" };

        let startLine = 0;
        let endLine = 0;

        if (editor.selection.isEmpty) {
            const pos = editor.selection.active;
            const ra = new vscode.Range(pos, pos.translate(0, 1));
            const charAtPos = document.getText(ra)
            if (charAtPos == "{" || charAtPos == "}") {
                await vscode.commands.executeCommand("editor.action.jumpToBracket")
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

        const startLineText = document.lineAt(startLine).text;
        const endLineText = document.lineAt(endLine).text;

        const startIndentation = startLineText.match(/^\s*/)?.[0] || '';
        const endIndentation = endLineText.match(/^\s*/)?.[0] || '';

        const start_fold = `${startIndentation}${commentSymbols.start}{{{\n`;
        const end_fold = `${endIndentation}${commentSymbols.start}}}}\n`;

        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(endLine + 1, 0), end_fold);
            editBuilder.insert(new vscode.Position(startLine, 0), start_fold);
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

        const document = editor.document
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line == node.start) || (pos.line == node.end))) {
                const startLineLen = document.lineAt(node.start).text.length;
                const endLineLen = document.lineAt(node.end).text.length;
                const range1 = new vscode.Range(node.start, 0, node.start, startLineLen);
                const range2 = new vscode.Range(node.end, 0, node.end, startLineLen);
                await editor.edit(editBuilder => {
                    editBuilder.delete(range2);
                    editBuilder.delete(range1);
                })
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

        const document = editor.document
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line == node.start) || (pos.line == node.end))) {
                const startLineLen = document.lineAt(node.start).text.length;
                const endLineLen = document.lineAt(node.end).text.length;
                const range1 = new vscode.Range(node.start, 0, node.start, startLineLen);
                const range2 = new vscode.Range(node.end, 0, node.end, startLineLen);
                await editor.edit(editBuilder => {
                    editBuilder.delete(range2);
                    editBuilder.delete(range1);
                })
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
        const document = editor.document
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line == node.start))) {
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
        const document = editor.document
        const foldTree = this.foldTrees.get(document.uri.toString());

        if (foldTree && editor.selection.isEmpty) {
            const pos = editor.selection.active;
            let node = foldTree.nodeAt(pos.line);
            if (node && ((pos.line == node.start))) {
                const endLineLen = document.lineAt(node.end).text.length;
                const range = new vscode.Range(node.start, 0, node.end, endLineLen);
                await vscode.env.clipboard.writeText(document.getText(range));
                await editor.edit(editBuilder => {
                    editBuilder.delete(range);
                })
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
        let t1 = performance.now()

        let content: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            content.push(document.lineAt(i).text);
        }

        let newFoldTree = new FoldTree(content, document.languageId);
        Logger.info('new fold tree created for \n' + document.uri.toString());
        this.foldTrees.set(document.uri.toString(), new FoldTree(content, document.languageId));

        let t2 = performance.now()
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
        let t1 = performance.now()
        Logger.info(`Deleting fold tree for ${document.uri.toString()}`);
        this.foldTrees.delete(document.uri.toString());

        let t2 = performance.now()
        let elapsed = t2 - t1;
        Logger.info(`deleteFoldTree: ${elapsed}`);
    }
    //..............................................................................................

    rebuildFoldTree(document: vscode.TextDocument) {
        let t1 = performance.now()
        Logger.info(`Rebuilding fold tree for ${document.uri.toString()}`)
        this.deleteFoldTree(document)
        this.createFoldTree(document)
    }
    //..............................................................................................
}
//..................................................................................................

