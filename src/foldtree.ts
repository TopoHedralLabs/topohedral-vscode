import { Stack } from 'typescript-collections';

interface FoldNodeJson {
    start: number;
    end: number;
    level: number;
    parent: number | null;
    children: number[];
    tag: number;
}

export const languageCommentMap: { [key: string]: { start: string; end: string } } = {
    "python": { start: "#", end: "" },
    "rust": { start: "//", end: "" },
    "shell": { start: "#", end: "" },
    "plaintext": { start: "//", end: "" },
};

export class FoldNode {
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
            parent: parentTag,
            children: childrenTags,
            tag: this.tag
        };
    }

    toString() {
        return JSON.stringify(this.toJson());
    }

    isLeaf() {
        return this.children.length === 0;
    }

    isRoot() {
        return this.parent === null;
    }
}

export interface FoldNodeVisiitor {
    visit(node: FoldNode): boolean;
}


export class FoldTree {

    private roots: FoldNode[] = []
    private nextTag: number = 0;
    //..............................................................................................

    /**
     * Constructs a new `FoldTree` instance with the provided `vscode.TextDocument`.
     * This method initializes the `FoldTree` by parsing the document and building the fold structure.
     *
     * @param document - The `vscode.TextDocument` to parse and build the fold tree for.
     */
    constructor(public document: string[], public languageId: string) {
        this.parseDocument();
    }
    //..............................................................................................

    /**
     * Finds the FoldNode that contains the given position in the document.
     * Traverses the FoldTree in a depth-first manner, checking each node's start and end positions
     * to determine if the given position is within the node's range.
     *
     * @param position - The position in the document to find the containing FoldNode for.
     * @returns The FoldNode that contains the given position, or null if no such node is found.
     */
    nodeAt(line: number): FoldNode | null {

        let out: FoldNode | null = null;
        let nodeStack = new Stack<FoldNode>();

        for (const root of this.roots) {
            if (line >= root.start && line <= root.end) {
                nodeStack.push(root);
                break;
            }
        }

        outerLoop: while (!nodeStack.isEmpty()) {
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
                            continue outerLoop;
                        }
                    }
                    out = node;
                    break;
                }
            }
        }

        return out;
    }
    //..............................................................................................


    insertNode(start: number, end: number): FoldNode | null {

        let out = null;




        return out;
    }
    //..............................................................................................

    nodeRanges(): Array<[number, number]> {
        let out: Array<[number, number]> = [];

        class NodeRangeVisitor implements FoldNodeVisiitor {
            visit(node: FoldNode) {
                out.push([node.start, node.end]);
                return true;
            }
        }
        this.visitorTraverse(new NodeRangeVisitor());

        return out;
    }
    //..............................................................................................

    /**
     * Traverses the FoldTree and visits each FoldNode using the provided FoldNodeVisitor.
     * The traversal is done in a depth-first order, visiting each node and its children.
     *
     * @param visitor - The FoldNodeVisitor instance to use for visiting each node.
     */
    visitorTraverse(visitor: FoldNodeVisiitor) {

        let nodeStack = new Stack<FoldNode>();

        for (const root of this.roots.reverse()) {
            nodeStack.push(root);
        }

        while (!nodeStack.isEmpty()) {
            const node = nodeStack.pop();
            if (node) {
                if (visitor.visit(node)) {
                    for (const child of node.children.reverse()) {
                        nodeStack.push(child);
                    }
                }
                else {
                    break;
                }
            }
        }
    }
    //..............................................................................................


    /**
     * Converts the FoldTree to a JSON representation, traversing the tree in depth-first order.
     *
     * @returns An array of FoldNodeJson objects representing the nodes in the FoldTree.
     */
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

    /**
     * Converts the FoldTree to a JSON string representation, traversing the tree in depth-first order.
     *
     * @returns A JSON string representation of the FoldTree.
     */
    private createNode(start: number, end: number, level: number): FoldNode {
        const tag = this.nextTag;
        this.nextTag += 1;
        return new FoldNode(start, end, [], null, level, tag);

    }

    /**
     * Parses the document and constructs a FoldTree representing the code folding regions.
     * The FoldTree is built by traversing the document line-by-line and detecting the start and end of fold regions based on the language-specific comment symbols.
     * The resulting FoldTree contains a hierarchy of FoldNode objects representing the nested code folding regions.
     */
    private parseDocument() {

        const languageId = this.languageId;
        const commentSymbols = languageCommentMap[languageId] || { start: "", end: "" };
        const startRegx = new RegExp(`${commentSymbols.start}{{{`);
        const endRegex = new RegExp(`${commentSymbols.start}}}}`);

        let level = 0;
        let nodeStack = new Stack<FoldNode>();

        for (let lineIndex = 0; lineIndex < this.document.length; lineIndex++) {
            const lineText = this.document[lineIndex]

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
                level -= 1;
                }
            }
        }
    }

}