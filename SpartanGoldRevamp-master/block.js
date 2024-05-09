"use strict";

const Blockchain = require('./blockchain.js');

const utils = require('./utils.js');
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');
/**
 * A block is a collection of transactions, with a hash connecting it
 * to a previous block.
 */
module.exports = class Block {

 
  constructor(rewardAddr, prevBlock, target, coinbaseReward, transactions = []) {
    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.target = target;
    this.rewardAddr = rewardAddr;
    this.coinbaseReward = coinbaseReward;
    this.chainLength = prevBlock ? prevBlock.chainLength + 1 : 0;
    this.timestamp = Date.now();
    this.balances = new Map(prevBlock ? prevBlock.balances : []);
    this.nextNonce = new Map(prevBlock ? prevBlock.nextNonce : []);

    this.merkleTree = new MerkleTree(transactions.map(tx => JSON.stringify(tx))); 

    
    if (prevBlock && prevBlock.rewardAddr) {
      // Add the previous block's rewards to the miner who found the proof.
      let winnerBalance = this.balanceOf(prevBlock.rewardAddr) || 0;
      this.balances.set(prevBlock.rewardAddr, winnerBalance + prevBlock.totalRewards());
    }

    // Storing transactions in a Map to preserve key order.
  //  this.transactions = new Map();

    // Adding toJSON methods for transactions and balances, which help with
    // serialization.
    // this.transactions.toJSON = () => {
    //   return JSON.stringify(Array.from(this.transactions.entries()));
    // }
    // this.balances.toJSON = () => {
    //   return JSON.stringify(Array.from(this.balances.entries()));
    // }


    // Used to determine the winner between competing chains.
    // Note that this is a little simplistic -- an attacker
    // could make a long, but low-work chain.  However, this works
    // well enough for us.
 //   this.chainLength = prevBlock ? prevBlock.chainLength+1 : 0;

  //  this.timestamp = Date.now();

    // The address that will gain both the coinbase reward and transaction fees,
    // assuming that the block is accepted by the network.
  //  this.rewardAddr = rewardAddr;

   // this.coinbaseReward = coinbaseReward;
  }

  /**
   * Determines whether the block is the beginning of the chain.
   *
   * @returns {Boolean} - True if this is the first block in the chain.
   */
  isGenesisBlock() {
    return this.chainLength === 0;
  }

  /**
   * Returns true if the hash of the block is less than the target
   * proof of work value.
   *
   * @returns {Boolean} - True if the block has a valid proof.
   */
  hasValidProof() {
    const rootHash = this.merkleTree.getRoot().toString('hex');
    const blockHash = utils.hash(rootHash + this.prevBlockHash + this.proof);
    return BigInt(`0x${blockHash}`) < this.target;
  }

  /**
   * Converts a Block into string form.  Some fields are deliberately omitted.
   * Note that Block.deserialize plus block.rerun should restore the block.
   *
   * @returns {String} - The block in JSON format.
   */
  serialize() {
    return JSON.stringify({
        prevBlockHash: this.prevBlockHash,
        merkleRoot: this.merkleTree.getRoot(),
        target: this.target,
        // Store only the root and not the individual transactions
        chainLength: this.chainLength,
        timestamp: this.timestamp,
        rewardAddr: this.rewardAddr,
        coinbaseReward: this.coinbaseReward
    });
}

   //if (this.isGenesisBlock()) {
   //  // The genesis block does not contain a proof or transactions,
   //  // but is the only block than can specify balances.
   //  /*******return `
   //     {"chainLength": "${this.chainLength}",
   //      "timestamp": "${this.timestamp}",
   //      "balances": ${JSON.stringify(Array.from(this.balances.entries()))}
   //     }
   //  `;****/
   //  let o = {
   //    chainLength: this.chainLength,
   //    timestamp: this.timestamp,
   //    balances: Array.from(this.balances.entries()),
   //  };
   //  return JSON.stringify(o, ['chainLength', 'timestamp', 'balances']);
   //} else {
   //  // Other blocks must specify transactions and proof details.
   //  /******return `
   //     {"chainLength": "${this.chainLength}",
   //      "timestamp": "${this.timestamp}",
   //      "transactions": ${JSON.stringify(Array.from(this.transactions.entries()))},
   //      "prevBlockHash": "${this.prevBlockHash}",
   //      "proof": "${this.proof}",
   //      "rewardAddr": "${this.rewardAddr}"
   //     }
   //  `;*****/
   //  let o = {
   //    chainLength: this.chainLength,
   //    timestamp: this.timestamp,
   //    transactions: Array.from(this.transactions.entries()),
   //    prevBlockHash: this.prevBlockHash,
   //    proof: this.proof,
   //    rewardAddr: this.rewardAddr,
   //  };
   //  return JSON.stringify(o, ['chainLength', 'timestamp', 'transactions',
   //       'prevBlockHash', 'proof', 'rewardAddr']);
   //}
  

  toJSON() {
    let o = {
      chainLength: this.chainLength,
      timestamp: this.timestamp,
    };
    if (this.isGenesisBlock()) {
      // The genesis block does not contain a proof or transactions,
      // but is the only block than can specify balances.
      o.balances = Array.from(this.balances.entries());
    } else {
      // Other blocks must specify transactions and proof details.
      o.transactions = Array.from(this.transactions.entries());
      o.prevBlockHash = this.prevBlockHash;
      o.proof = this.proof;
      o.rewardAddr = this.rewardAddr;
    }
    return o;
  }

  /**
   * Returns the cryptographic hash of the current block.
   * The block is first converted to its serial form, so
   * any unimportant fields are ignored.
   *
   * @returns {String} - cryptographic hash of the block.
   */
  hashVal() {
    return utils.hash(this.serialize());
  }

  /**
   * Returns the hash of the block as its id.
   *
   * @returns {String} - A unique ID for the block.
   */
  get id() {
    return this.hashVal();
  }

  /**
   * Accepts a new transaction if it is valid and adds it to the block.
   *
   * @param {Transaction} tx - The transaction to add to the block.
   * @param {Client} [client] - A client object, for logging useful messages.
   *
   * @returns {Boolean} - True if the transaction was added successfully.
   */
  addTransaction(tx, client, maxSizeBytes) {
    
    if (this.transactions.find(t => t.id === tx.id)) {
      if (client) client.log(`Duplicate transaction ${tx.id}.`);
      return false;
      
    }

    const newTransactions = [...this.merkleTree.transactions, JSON.stringify(transaction)];
    this.merkleTree = new MerkleTree(newTransactions);


    const leaves = this.transactions.map(tx => utils.hash(JSON.stringify(tx))); // Use utils.hash to hash the transactions
    this.merkleTree = new MerkleTree(leaves, utils.hash, { sortPairs: true }); 



    if (this.transactions.get(tx.id)) {
      if (client) client.log(`Duplicate transaction ${tx.id}.`);
      return false;
    } else if (tx.sig === undefined) {
      if (client) client.log(`Unsigned transaction ${tx.id}.`);
      return false;
    } else if (!tx.validSignature()) {
      if (client) client.log(`Invalid signature for transaction ${tx.id}.`);
      return false;
    } else if (!tx.sufficientFunds(this)) {
      if (client) client.log(`Insufficient gold for transaction ${tx.id}.`);
      return false;
    }

    // Checking and updating nonce value.
    // This portion prevents replay attacks.
    let nonce = this.nextNonce.get(tx.from) || 0;
    if (tx.nonce < nonce) {
      if (client) client.log(`Replayed transaction ${tx.id}.`);
      return false;
    } else if (tx.nonce > nonce) {
      // FIXME: Need to do something to handle this case more gracefully.
      if (client) client.log(`Out of order transaction ${tx.id}.`);
      return false;
    } else {
      this.nextNonce.set(tx.from, nonce + 1);
    }

    // Adding the transaction to the block
    this.transactions.set(tx.id, tx);

    // Taking gold from the sender
    let senderBalance = this.balanceOf(tx.from);
    this.balances.set(tx.from, senderBalance - tx.totalOutput());

    // Giving gold to the specified output addresses
    tx.outputs.forEach(({amount, address}) => {
      let oldBalance = this.balanceOf(address);
      this.balances.set(address, amount + oldBalance);
    });

    return true;

    /*

    const serializedTx = JSON.stringify(tx);
    const txSizeBytes = Buffer.byteLength(serializedTx, 'utf8');

    // Check if adding this transaction would exceed the block size limit
    if (this.getBlockSizeBytes() + txSizeBytes > maxSizeBytes) {
      if (client) client.log(`Transaction ${tx.id} exceeds block size limit.`);
      return false;
    }

    // Add transaction to block
    this.transactions.push(tx);
    this.merkleTree = new MerkleTree([...this.merkleTree.getLeaves(), serializedTx]);

    ...

    return true;
    */
  }

  /**
   * When a block is received from another party, it does not include balances or a record of
   * the latest nonces for each client.  This method restores this information be wiping out
   * and re-adding all transactions.  This process also identifies if any transactions were
   * invalid due to insufficient funds or replayed transactions, in which case the block
   * should be rejected.
   *
   * @param {Block} prevBlock - The previous block in the blockchain, used for initial balances.
   *
   * @returns {Boolean} - True if the block's transactions are all valid.
   */
  rerun(prevBlock) {
    // Setting balances to the previous block's balances.
    this.balances = new Map(prevBlock.balances);
    this.nextNonce = new Map(prevBlock.nextNonce);

    // Adding coinbase reward for prevBlock.
    let winnerBalance = this.balanceOf(prevBlock.rewardAddr);
    if (prevBlock.rewardAddr) this.balances.set(prevBlock.rewardAddr, winnerBalance + prevBlock.totalRewards());

    // Re-adding all transactions.
    let txs = this.transactions;
    this.transactions = new Map();
    for (let tx of txs.values()) {
      let success = this.addTransaction(tx);
      if (!success) return false;
    }

    return true;
  }

  /**
   * Gets the available gold of a user identified by an address.
   * Note that this amount is a snapshot in time - IF the block is
   * accepted by the network, ignoring any pending transactions,
   * this is the amount of funds available to the client.
   *
   * @param {String} addr - Address of a client.
   *
   * @returns {Number} - The available gold for the specified user.
   */
  balanceOf(addr) {
    return this.balances.get(addr) || 0;
  }

  /**
   * The total amount of gold paid to the miner who produced this block,
   * if the block is accepted.  This includes both the coinbase transaction
   * and any transaction fees.
   *
   * @returns {Number} Total reward in gold for the user.
   *
   */
  totalRewards() {
    return [...this.transactions].reduce(
      (reward, [, tx]) => reward + tx.fee,
      this.coinbaseReward);
  }

  /**
   * Determines whether a transaction is in the block.  Note that only the
   * block itself is checked; if it returns false, the transaction might
   * still be included in one of its ancestor blocks.
   *
   * @param {Transaction} tx - The transaction that we are checking for.
   *
   * @returns {boolean} - True if the transaction is contained in this block.
   */
  contains(tx) {
    return this.transactions.has(tx.id);
  }

  getBlockSizeBytes() {
    const serializedTransactions = this.transactions.map(tx => JSON.stringify(tx));
    const serializedBlock = JSON.stringify({
      prevBlockHash: this.prevBlockHash,
      timestamp: this.timestamp,
      transactions: serializedTransactions,
      rewardAddr: this.rewardAddr,
      coinbaseReward: this.coinbaseReward
    });

    return Buffer.byteLength(serializedBlock, 'utf8');
  }
};
