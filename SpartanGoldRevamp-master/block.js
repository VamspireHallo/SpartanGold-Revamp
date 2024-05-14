"use strict";

const Blockchain = require('./blockchain.js');

const utils = require('./utils.js');
const { MerkleTree } = require('./MerkleTree.js');
/**
 * A block is a collection of transactions, with a hash connecting it
 * to a previous block.
 */
module.exports = class Block {

  /**
   * Creates a new Block.  Note that the previous block will not be stored;
   * instead, its hash value will be maintained in this block.
   *
   * @constructor
   * @param {String} rewardAddr - The address to receive all mining rewards for this block.
   * @param {Block} [prevBlock] - The previous block in the blockchain.
   * @param {Number} [target] - The POW target.  The miner must find a proof that
   *      produces a smaller value when hashed.
   * @param {Number} [coinbaseReward] - The gold that a miner earns for finding a block proof.
   */
  constructor(rewardAddr, prevBlock, target = Blockchain.POW_TARGET, coinbaseReward = Blockchain.COINBASE_AMT_ALLOWED) {
    this.prevBlockHash = prevBlock ? prevBlock.hashVal() : null;
    this.target = target;
    this.balances = prevBlock ? new Map(prevBlock.balances) : new Map();
    this.nextNonce = prevBlock ? new Map(prevBlock.nextNonce) : new Map();
    this.chainLength = prevBlock ? prevBlock.chainLength + 1 : 0;
    this.timestamp = Date.now();
    this.rewardAddr = rewardAddr;
    this.coinbaseReward = coinbaseReward;

    if (prevBlock && prevBlock.rewardAddr) {
      // Add the previous block's rewards to the miner who found the proof.
      let winnerBalance = this.balanceOf(prevBlock.rewardAddr) || 0;
      this.balances.set(prevBlock.rewardAddr, winnerBalance + prevBlock.totalRewards());
    }

    this.transactions = new MerkleTree();
    
    this.currentBlockSize = 0;
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
   * Adds the block to the blockchain by calling the addBlock method.
   *
   * @param {Blockchain} blockchain - The blockchain instance to add the block to.
   * @returns {Boolean} - True if the block was added successfully.
   */
  addToBlockchain(blockchain) {
    if (!blockchain || !(blockchain instanceof Blockchain)) {
      console.log('Invalid blockchain instance provided.');
      return false;
    }

    return blockchain.addBlock(this);
  }

  /**
   * Converts a Block into string form.  Some fields are deliberately omitted.
   * Note that Block.deserialize plus block.rerun should restore the block.
   *
   * @returns {String} - The block in JSON format.
   */
  serialize() {
    return JSON.stringify(this);
  }

/**
   * Returns true if the hash of the block is less than the target
   * proof of work value.
   *
   * @returns {Boolean} - True if the block has a valid proof.
   */
hasValidProof() {
  let h = utils.hash(this.serialize());
  let n = BigInt(`0x${h}`);
  return n < this.target;
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
      o.balances = Array.from(this.balances.entries());
    } else {
      o.prevBlockHash = this.prevBlockHash;
      o.transactions = this.transactions;
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
  addTransaction(tx, client) {

    const txSize = Buffer.byteLength(JSON.stringify(tx));
    
    console.log(`Checking current block size, ${this.currentBlockSize + txSize} compared to max block size, ${Blockchain.MAX_BLOCK_SIZE_BYTES}`);
    if (this.currentBlockSize + txSize > Blockchain.MAX_BLOCK_SIZE_BYTES) {
      if (client) client.log(`Transaction ${tx.id} exceeds block size limit.`);
      return false;
    }

    // Updating block size
    this.currentBlockSize += txSize;

    if(tx.sig === undefined){
      if (client) client.log(`Signature undefined ${tx.id}.`);
      return false;
    }
    else if (!tx.validSignature()) {
      if (client) client.log(`Invalid signature for transaction ${tx.id}.`);
      return false;
    } else if (!tx.sufficientFunds(this)) {
      if (client) client.log(`Insufficient gold for transaction ${tx.id}.`);
      return false;
    }
    
    if (this.transactions.hasTransaction(tx)) {
      if (client) client.log(`Duplicate transaction ${tx.id}.`);
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
    this.transactions.addtxn(tx);

    this.updateBalances(tx);

    return true;
  }

  updateBalances(tx) {
    let senderBalance = this.balanceOf(tx.from);
    this.balances.set(tx.from, senderBalance - tx.totalOutput());

    tx.outputs.forEach(({ amount, address }) => {
        let oldBalance = this.balanceOf(address);
        this.balances.set(address, amount + oldBalance);
    });
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
    this.balances = new Map(prevBlock.balances);
    this.nextNonce = new Map(prevBlock.nextNonce);

    let winnerBalance = this.balanceOf(prevBlock.rewardAddr);
    if (prevBlock.rewardAddr) this.balances.set(prevBlock.rewardAddr, winnerBalance + prevBlock.totalRewards());

    let txs = this.transactions.getTransactions();
    this.transactions = new MerkleTree();
    for (let tx of txs) {
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
    let totalFee = 0;
    const transactions = this.transactions.getTransactions(); 
    for(const tx of transactions){
      totalFee += tx.fee;
    }
    return this.coinbaseReward+ totalFee;
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
    if(!this.transactions){
      return false;
    }
    return this.transactions.hasTransaction(tx) !== null;  
  }
};
