
import { expect } from 'chai'   
import { FoldTree } from '../../src/parser'
import * as vscode from 'vscode';
import { assert } from 'console';


(describe('FoldTree', () => {
    function createTextDocument(content: string): vscode.TextDocument {
        return {
            lineCount: content.split('\n').length,
            lineAt: (line: number) => ({
                text: content.split('\n')[line]
            }), 
            languageId: "plaintext"
        } as vscode.TextDocument;
    }

    it('should parse single fold', () => {
        const content = 
        `//{{{
        this is a fold
        //}}}`;
        const document = createTextDocument(content);
        const foldTree = new FoldTree(document);

        for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
            let node = foldTree.nodeAt(new vscode.Position(lineIndex, 0));
            expect(node).to.not.be.null;   
            expect(node!.start).to.equal(0);
            expect(node!.end).to.equal(2);
            expect(node!.tag).to.equal(2);
        }

    });
    it('should parse nested folds', () => {
        const content = 
        `//{{{
        this is a fold
            //{{{
            this is a fold2
            this is text
            //}}}
        //}}}`;
        const document = createTextDocument(content);

        const foldTree = new FoldTree(document);
        console.log(foldTree.toString());

    });
    it('should parse more nested folds', () => {
        const content = 
        `//{{{
            //{{{
                //{{{
                //}}}
                //{{{
                //}}}
                //{{{
                //}}}
                //{{{
                //}}}
            //}}}
            //{{{
            //}}}
        //}}}
        //{{{
            //{{{
                //{{{
                    //{{{
                    a
                    b
                    c
                    //}}}
                //}}}
            //}}}
        //}}}`;
        const document = createTextDocument(content);
        const foldTree = new FoldTree(document);
        console.log(foldTree.toString());

    });
}))