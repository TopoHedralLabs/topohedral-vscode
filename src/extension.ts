// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { FoldTree, languageCommentMap } from './foldtree';
import { start } from 'repl';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (outputChannel.appendLine) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    const outputChannel = vscode.window.createOutputChannel('Topohedral');
    outputChannel.appendLine('Congratulations, your extension "topohedral-vscode" is now active!');

    let state = new TopoHedralVscodeState(outputChannel);

    {
        outputChannel.appendLine('adding onDidOpenTextDocument handler');
        let disposable = vscode.workspace.onDidOpenTextDocument((document) => {
            outputChannel.appendLine('onDidOpenTextDocument handler called for ' + document.uri.toString());
            outputChannel.appendLine('is of type ' + document.languageId);
            if (languageCommentMap[document.languageId]) {

                outputChannel.appendLine('creating new fold tree for' + document.uri.toString());
                state.createFoldTree(document);
            }
        });
        context.subscriptions.push(disposable);
    }

    {
        outputChannel.appendLine('adding onDidCloseTextDocument handler');
        let disposable = vscode.workspace.onDidCloseTextDocument((document) => {
            outputChannel.appendLine('onDidCloseTextDocument handler called');
            outputChannel.appendLine('is of type ' + document.languageId);
            if (languageCommentMap[document.languageId]) {
                state.deleteFoldTree(document);
            }
        });
        context.subscriptions.push(disposable);
    }

    {
        outputChannel.appendLine('adding onDidSaveTextDocument handler');
        let disposable = vscode.workspace.onDidSaveTextDocument((document) => {
            outputChannel.appendLine('onDidSaveTextDocument handler called');
        });
        context.subscriptions.push(disposable);
    }

    {
        outputChannel.appendLine('adding onDidChangeTextDocument handler');
        let disposable = vscode.workspace.onDidChangeTextDocument((event) => {

            if (event.document.uri.scheme != "output") {
                outputChannel.appendLine('onDidChangeTextDocument handler called for ' + event.document.uri.toString());
                if (languageCommentMap[event.document.languageId]) {
                    outputChannel.appendLine('creating new fold tree for ' + event.document.uri.toString());
                    state.rebuildFoldTree(event.document)
                }

            }
        });
        context.subscriptions.push(disposable);
    }

    // .............................. commands
    {
        outputChannel.appendLine('Registering topohedral-vscode.addFold');
        let disposable = vscode.commands.registerCommand('topohedral-vscode.addFold', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const document = editor.document;
                const selection = editor.selection;
                outputChannel.appendLine("Adding fold for file " + document.uri.toString());
                state.addFold();
            }
        });
        context.subscriptions.push(disposable);
    }

    {
        outputChannel.appendLine('Registering topohedral-vscode.removeFold');
        let disposable = vscode.commands.registerCommand('topohedral-vscode.removeFold', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const document = editor.document;
                const selection = editor.selection;
                outputChannel.appendLine("Removing fold for file " + document.uri.toString());
                state.removeFold();
            }
        });
        context.subscriptions.push(disposable);
    }

    // .............................. folding provider 
    outputChannel.appendLine('Registernig the folding provider');
    Object.keys(languageCommentMap).forEach(language => {
        outputChannel.appendLine('Registering folding provider for ' + language);
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

    constructor(private channel: vscode.OutputChannel) {
        this.channel = channel;
    }
    //..............................................................................................

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

        this.channel.appendLine('provideFoldingRanges called for ' + document.uri.toString());
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
        this.channel.appendLine(`provideFoldingRanges: ${elapsed}`);
        return ranges;
    }
    //..............................................................................................

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
        this.channel.appendLine('new fold tree created for \n' + document.uri.toString());
        this.foldTrees.set(document.uri.toString(), new FoldTree(content, document.languageId));

        let t2 = performance.now()
        let elapsed = t2 - t1;
        this.channel.appendLine(`createFoldTree: ${elapsed}`);
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

        this.channel.appendLine(`Deleting fold tree for ${document.uri.toString()}`);
        this.foldTrees.delete(document.uri.toString());

        let t2 = performance.now()
        let elapsed = t2 - t1;
        this.channel.appendLine(`deleteFoldTree: ${elapsed}`);
    }
    //..............................................................................................

    rebuildFoldTree(document: vscode.TextDocument) {
        let t1 = performance.now()
        this.channel.appendLine(`Rebuilding fold tree for ${document.uri.toString()}`)
        this.deleteFoldTree(document)
        this.createFoldTree(document)
    }
    //..............................................................................................

    /**
     * TOOD implement this
     * Updates the fold tree for a document when its content changes.
     * 
     * This method is called when a text document is changed, and it updates the
     * corresponding fold tree to reflect the changes. It iterates through the
     * content changes and updates the fold tree accordingly.
     * 
     * @param event - The text document change event that triggered the update.
     */
    updateFoldTree(event: vscode.TextDocumentChangeEvent) {
        const foldTree = this.foldTrees.get(event.document.uri.toString());
        if (foldTree) {

            for (const change of event.contentChanges) {
                // foldTree.update(change.range.start.line, 
                //                 change.text.split('\n'));
            }
        }
    }
    //..............................................................................................

    toString() {
        for (const [key, value] of this.foldTrees) {
            console.log(key, value);
        }
    }
    //..............................................................................................
}
//..................................................................................................

