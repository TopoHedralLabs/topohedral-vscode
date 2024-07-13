// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { languageCommentMap } from './parser';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "topohedral-vscode" is now active!');

    console.log('Registernig the folding provider');
    Object.keys(languageCommentMap).forEach(language => {
        const foldingRangeProvider = foldProvider();
        const disposableFolding = vscode.languages.registerFoldingRangeProvider(
            { scheme: 'file', language },
            foldingRangeProvider
        );
        context.subscriptions.push(disposableFolding);
    });

    console.log('Registerig the command addFold');
    let disposable = vscode.commands.registerCommand('topohedral-vscode.addFold', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const selection = editor.selection;

            addFold(document, selection);
        }
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function addFold(document: vscode.TextDocument, selection: vscode.Selection) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const languageId = document.languageId;
    const commentSymbols = languageCommentMap[languageId] || { start: "", end: "" };

    const startLine = selection.start.line;
    const endLine = selection.end.line;

    const startLineText = document.lineAt(startLine).text;
    const endLineText = document.lineAt(endLine).text;

    const startIndentation = startLineText.match(/^\s*/)?.[0] || '';
    const endIndentation = endLineText.match(/^\s*/)?.[0] || '';

    const start_fold = `${startIndentation}${commentSymbols.start}{{{\n`;
    const end_fold = `${endIndentation}${commentSymbols.start}}}}`;

    editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(startLine, 0), start_fold);
        editBuilder.insert(new vscode.Position(endLine + 1, 0), end_fold);
    });
}

function foldProvider(): vscode.FoldingRangeProvider {
    return {
        provideFoldingRanges(
            document: vscode.TextDocument,
            context: vscode.FoldingContext,
            token: vscode.CancellationToken
        ): vscode.FoldingRange[] | Thenable<vscode.FoldingRange[]> {
            const ranges: vscode.FoldingRange[] = [];
            const startRegex = /\{\{\{/;
            const endRegex = /\}\}\}/;

            let startLine: number | null = null;

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);

                if (startLine === null && startRegex.test(line.text)) {
                    startLine = i;
                } else if (startLine !== null && endRegex.test(line.text)) {
                    ranges.push(new vscode.FoldingRange(startLine, i));
                    startLine = null;
                }
            }

            return ranges;
        }
    };
}