import * as vscode from 'vscode';
import { Stack } from 'typescript-collections';

interface FoldNodeJson {
    start: number;
    end: number;
    level: number;
    parentIndex: number | null;
    childrenIndices: number[];
    tag: number;
}

export const languageCommentMap: { [key: string]: { start: string; end: string } } = {
    "python": { start: "#", end: "" },
    "rust": { start: "//", end: "" },
    "shell": { start: "#", end: "" },
    "plaintext": { start: "//", end: "" },
};

class FoldNode {
    constructor(
        public start: number,
        public end: number,
        public children: FoldNode[],
        public parent: FoldNode | null,
        public level: number,
        public tag: number) { }

    toJson() {
        const childrenTags = this.children.map(child => child.tag);
        const parentTag = this.parent ? this.parent.tag : null;

        return {
            start: this.start,
            end: this.end,
            level: this.level,
            parentIndex: parentTag,
            childrenIndices: childrenTags,
            tag: this.tag
        };
    }

    isLeaf() {
        return this.children.length === 0;
    }

    isRoot() {
        return this.parent === null;
    }
}


export class FoldTree {

    private roots: FoldNode[] = []
    private nextTag: number = 0;

    constructor(public document: vscode.TextDocument) {
        this.parseDocument();
    }

    nodeAt(position: vscode.Position): FoldNode | null {
        const line = position.line;

        let out: FoldNode | null = null;
        let nodeStack = new Stack<FoldNode>();

        for (const root of this.roots) {
            if (line >= root.end && line <= root.end) {
                nodeStack.push(root);
            }
        }

        while (!nodeStack.isEmpty()) {
            const node = nodeStack.pop();
            if (node) {
                if (node.isLeaf()) {
                    out = node;
                    break;
                }
                else {

                    for (const child of node.children) {
                        if (line >= child.start && line <= child.end) {
                            nodeStack.push(child);
                            continue
                        }
                    }
                    out = node;
                    break;
                }
            }
        }

        return out;
    }

    toJson() {
        const jsonNodes: FoldNodeJson[] = [];

        function traverseNode(node: FoldNode | null) {
            if (!node) return;

            const jsonNode = node.toJson();
            jsonNodes.push(jsonNode);

            for (const child of node.children) {
                traverseNode(child);
            }
        }

        for (const root of this.roots) {
            traverseNode(root);
        }

        return jsonNodes;
    }

    toString() {
        return JSON.stringify(this.toJson(), null, 2);
    }

    private createNode(start: number, end: number, level: number): FoldNode {
        const tag = this.nextTag;
        this.nextTag += 1;
        return new FoldNode(start, end, [], null, level, tag);

    }

    private parseDocument() {

        const languageId = this.document.languageId;
        const commentSymbols = languageCommentMap[languageId] || { start: "", end: "" };
        const startRegx = new RegExp(`${commentSymbols.start}{{{`);
        const endRegex = new RegExp(`${commentSymbols.start}}}}`);

        let level = 0;
        let nodeStack = new Stack<FoldNode>();

        for (let lineIndex = 0; lineIndex < this.document.lineCount; lineIndex++) {
            const line = this.document.lineAt(lineIndex);
            const lineText = line.text;

            if (startRegx.test(lineText)) {
                level += 1;

                let newNode = this.createNode(lineIndex, lineIndex, level);
                nodeStack.push(newNode);

            }

            if (endRegex.test(lineText)) {

                let newNode = nodeStack.pop();
                if (newNode) {
                    newNode.end = lineIndex;

                    if (level == 1) {
                        this.roots.push(newNode);
                    }
                    else if (level > 1) {

                        let prevNode = nodeStack.peek();
                        if (prevNode) {
                            newNode.parent = prevNode;
                            prevNode.children.push(newNode);
                        }

                    }
                }
                level -= 1;
            }
        }
    }

}