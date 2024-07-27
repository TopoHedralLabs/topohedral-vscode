
import * as assert from 'assert';
import * as mocha from 'mocha';
// import * as myExtension from '../../extension';
import { FoldTree, FoldNode } from '../foldtree';


describe('Parser Test Suite', () => {

    function nodeAssert(node: FoldNode | null, start: number, end: number, level: number, parent: number | null, children: number[]) {
        assert.equal(node?.start, start);
        assert.equal(node?.end, end);
        assert.equal(node?.level, level);
        assert.equal(node?.parent?.tag, parent);

        assert.equal(node?.children.length, children.length);
        for (let i = 0; i < children.length; i++) {
            assert.equal(node?.children[i].tag, children[i]);
        }
    }

    it('single fold', () => {
        const content =
            `//{{{
            this is a fold
            //}}}`.split('\n');

        const foldTree = new FoldTree(content, "plaintext");

        // console.log(foldTree.toString());

        for (let lineIndex = 0; lineIndex < content.length; lineIndex++) {
            let node = foldTree.nodeAt(lineIndex);
            nodeAssert(node, 0, 2, 1, null, []);
        }

    });
    it('nested folds', () => {
        const content =
            `//{{{
        this is a fold
            //{{{
            this is a fold2
            this is text
            //}}}
        //}}}`.split('\n');

        const foldTree = new FoldTree(content, "plaintext");

        for (let lineIndex of [0, 1, 6]) {
            let node = foldTree.nodeAt(lineIndex);
            nodeAssert(node, 0, 6, 1, null, [1]);
        }
        for (let lineIndex of [2, 3, 4, 5]) {
            let node = foldTree.nodeAt(lineIndex);
            nodeAssert(node, 2, 5, 2, 0, []);
        }
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
        a
        b
        //{{{
        //}}}`.split('\n');
        const foldTree = new FoldTree(content, "plaintext");

        let n0 = foldTree.nodeAt(3);
        nodeAssert(n0, 2, 3, 3, 1, []);

        let n1 = foldTree.nodeAt(10);
        nodeAssert(n1, 1, 10, 2, 0, [2, 3, 4, 5]);

        let n2 = foldTree.nodeAt(12);
        nodeAssert(n2, 11, 12, 2, 0, []);
    });
    it('should parse file with unbalanced folds', () => {
        const content =
            `//}}}
             //}}}
             //{{{
                //{{{
                //}}}
             //}}}
             //{{{`.split('\n');

        const foldTree = new FoldTree(content, "plaintext");
        console.log(foldTree.toString());

        for (let lineIndex of [0, 1, 6]) {
            let node = foldTree.nodeAt(lineIndex);
            assert.equal(node, null);
        }

        let n0 = foldTree.nodeAt(2);
        nodeAssert(n0, 2, 5, 1, null, [1]);

        let n1 = foldTree.nodeAt(4);
        nodeAssert(n1, 3, 4, 2, 0, []);
    });
});

describe('Node range test suite', () => {
    it('should return the correct range for', () => {

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
        a
        b
        //{{{
        //}}}`.split('\n');

        const foldTree = new FoldTree(content, "plaintext");

        let ranges =  foldTree.nodeRanges();

        console.log(ranges);


    });
});
