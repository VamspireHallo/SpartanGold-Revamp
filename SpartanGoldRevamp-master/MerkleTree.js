"use strict";

const utils = require('./utils.js');

// Stores transactions in a MerkleTree format.
// The tree will be perfectly balanced.
class MerkleTree {

    // Returns the size
    static calculateSize(numElems) {
        // Calculate a power of 2 at least as large as numElems.
        let n = 1;
        while (n < numElems) {
            n *= 2;
        }
        // We need almost double the space to hold the parent hashes.
        // E.g. if we have 8 transactions, we need to store their 8
        // hashes plus the 7 parent hashes.
        return (n * 2) - 1;
    }

    // Hashes from a node to the Merkle root, or until it does not have
    // the other half of the hash needed to continue to the root.
    static hashToRoot(hashes, i) {
        if (i === 0) return;
        let par = (i-2)/2;
        hashes[par] = utils.hash("" + hashes[i-1] + "," + hashes[i]);

        // Test to see if we are the right subnode. If so, we can hash
        // with the left subnode to continue one level up.
        if (par%2 === 0) {
            this.hashToRoot(hashes, par);
        }
    }

    getTransactions() {
        return this.transactions;  // assuming this.transactions is an array of transaction objects
    }


    constructor(transactions) {
        // Actual transactions
        this.transactions = [];
        this.levels = [];

        // Transaction hashes
        this.hashes = [];

        // hash-to-index Lookup table
       // this.lookup = {};
        this.rootHash = null;
        this.createNewTree(transactions);
    }

    createNewTree(transactions){
        if (!transactions || transactions.length === 0) {
            this.levels.push([]);
            this.rootHash = null;
            this.transactions = [];
            return; 
        }

        let leaves = [];
        if (this.levels[0] && this.levels[0].length !== 0) {
            leaves = this.levels[0];
        } else {
            leaves = transactions.map(transaction => utils.hash(JSON.stringify(transaction)));
        }

        this.levels = [];
        this.levels.push(leaves);
        while (leaves.length > 1) {
            let level = [];
            for (let i = 0; i < leaves.length; i += 2) {
                let parentH = leaves[i];
                if (i + 1 < leaves.length) {
                    parentH += leaves[i + 1];
                }
                level.push(utils.hash(parentH));
            }
            this.levels.push(level);
            leaves = level;
        }
        this.rootHash = leaves[0];
    }
    




    


    // Returns the Merkle root
    getroot() {
        return this.hashes[0];
    }

    getPath(transaction) {
        let h = utils.hash(transaction);
        let i = this.lookup[h];
        let path = { txInd: i, nodes: [] };
        let sibling;

        for(let j = i; j > 0; j = Math.floor((j-2)/2)){

        if(j%2 === 0){
            sibling = j-1;
        }
        else{
            sibling = j+1;
        }

        let nodeObj = {position:j, sibling: this.hashes[sibling] };
            path.nodes.push(nodeObj);
        }
        // **YOUR CODE HERE**
        //
        // Starting at i, build up a path to the root, containing ONLY the nodes
        // needed to reconstruct the Merkle root. Include their position in the
        // array so that a user who knows only the path and the Merkle root can
        // verify the path.
    }

    addtxn(thisTransaction) {
        let leafHash = utils.hash(JSON.stringify(thisTransaction));
        if (this.levels.length === 0) {
            this.levels.push([leafHash]);
            this.rootHash = leafHash;
            return;
        }
        this.levels[0].push(leafHash)

        this.createNewTree(this.levels[0]);
        this.transactions.push(thisTransaction);
    }

    // Return true if the tx matches the path.
    verify(tx, path) {
        let i = path.txInd;
        let h = utils.hash(tx);
        let tempChildHash;

        for(let thisNode in path.nodes){
            if(i %2 === 0){ 
                tempChildHash = utils.hash(thisNode.sibling + this.hashes[i]);
            }
            else{ //node in path is left child
                tempChildHash = utils.hash(this.hashes[i] + thisNode.sibling );
            }

            if(tempChildHash != this.hashes[ (node.position-2)/2 ]){
                return false;
            }

            i = Math.floor((node.position-2)/2);
        }

        return getRoot() === h;
        // **YOUR CODE HERE**
        //
        // starting at i, hash the appropriate nodes and verify that their hashes
        // match their parent nodes, until finally hitting the Merkle root.
        // If the Merkle root matches the path, return true.
    }

    hasTransaction(thisTx){
        if(this.transactions){
            return this.transactions.includes(thisTx);
        }
        return false;
    }

    // Returns a boolean indicating whether this node is part
    // of the Merkle tree.
    contains(t) {
        let h = utils.hash(t);
        return this.lookup[h] !== undefined;
    }

    // Method to print out the tree, one line per level of the tree.
    // Note that hashes are truncated to 6 characters for the sake
    // of brevity.
    display() {
        let i = 0;
        let nextRow = 0;
        let s = "";

        console.log();

        while (i < this.hashes.length) {
            s += this.hashes[i].slice(0,6) + " ";
            if (i === nextRow) {
                console.log(s);
                s = "";
                nextRow = (nextRow+1) * 2;
            }
            i++;
        }
    }


    getRootHash() {
        let allHashes = this.levels[this.levels.length - 1];
        return allHashes[0];
    }

}


exports.MerkleTree = MerkleTree;
