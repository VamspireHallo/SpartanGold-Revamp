"use strict";
const { MerkleTree } = require('./MerkleTree.js');


// Network message constants
const MISSING_BLOCK = "MISSING_BLOCK";
const POST_TRANSACTION = "POST_TRANSACTION";
const PROOF_FOUND = "PROOF_FOUND";
const START_MINING = "START_MINING";

// Constants for mining
const NUM_ROUNDS_MINING = 2000;

// Constants related to proof-of-work target
const POW_BASE_TARGET = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const POW_LEADING_ZEROES = 15;

// Constants for mining rewards and default transaction fees
const COINBASE_AMT_ALLOWED = 25;
const DEFAULT_TX_FEE = 1;

// If a block is 6 blocks older than the current block, it is considered
// confirmed, for no better reason than that is what Bitcoin does.
// Note that the genesis block is always considered to be confirmed.
const CONFIRMED_DEPTH = 6;

// Implementing Fixed Block Sizes
const MAX_BLOCK_SIZE_BYTES = 1024;

/**
 * The Blockchain class tracks configuration information and settings for the
 * blockchain, as well as some utility methods to allow for easy extensibility.
 * Note that the genesis block is the only direct reference to a block, since
 * different clients may have different blocks.
 */
module.exports = class Blockchain {
  static get MISSING_BLOCK() { return MISSING_BLOCK; }
  static get POST_TRANSACTION() { return POST_TRANSACTION; }
  static get PROOF_FOUND() { return PROOF_FOUND; }
  static get START_MINING() { return START_MINING; }

  static get NUM_ROUNDS_MINING() { return NUM_ROUNDS_MINING; }

  // Configurable properties, with static getters for convenience.
  static get POW_TARGET() {
    let bc = Blockchain.getInstance();
    return bc.powTarget;
  }

  static get COINBASE_AMT_ALLOWED() {
    let bc = Blockchain.getInstance();
    return bc.coinbaseReward;
  }

  static get DEFAULT_TX_FEE() {
    let bc = Blockchain.getInstance();
    return bc.defaultTxFee;
  }

  static get CONFIRMED_DEPTH() {
    let bc = Blockchain.getInstance();
    return bc.confirmedDepth;
  }
  
  // Exporting max block size
  static get MAX_BLOCK_SIZE_BYTES() { return MAX_BLOCK_SIZE_BYTES; }

  /**
   * Produces a new genesis block, giving the specified clients the amount of
   * starting gold specified in the initialBalances field of the Blockchain
   * instance.  This function also sets the genesis block for every client in
   * the clients field of the Blockchain instance.
   *
   * @returns {Block} - The genesis block.
   */
  static makeGenesis() {

    let g = this.makeBlock();

    let bc = Blockchain.getInstance();

    // Initializing starting balances in the genesis block.
    g.balances = new Map(bc.initialBalances);

    for (let client of bc.clients) {
      client.setGenesisBlock(g);
    }

    return g;
  }

  /**
   * Converts a string representation of a block to a new Block instance.
   *
   * @param {Object} o - An object representing a block, but not necessarily an instance of Block.
   *
   * @returns {Block}
   */
  static deserializeBlock(o) {
    if (o instanceof this.instance.blockClass) {
      return o;
    }

    let block = new this.instance.blockClass();
    block.chainLength = parseInt(o.chainLength, 10);
    block.timestamp = o.timestamp;

    //if its the first block ever
    if (block.isGenesisBlock()) {
      o.balances.forEach(([clientID,amount]) => {
        b.balances.set(clientID, amount);
      });
    } else {
      block.prevBlockHash = o.prevBlockHash;
      block.proof = o.proof;
      block.rewardAddr = o.rewardAddr;

      block.transactions = new MerkleTree();
      if (o.transactions) {
        o.transactions.transactions.forEach(tx => {
          let newTransaction = this.makeTransaction(tx);
          
          block.transactions.addtxn(newTransaction);
        });
      }
    }

    return block;
  }

  //dont use
  rebuildMerkleTree() {
    // Map transactions 
    const leaves = this.transactions.map(tx => SHA256(JSON.stringify(tx)));
    this.merkleTree = new MerkleTree(leaves, SHA256);
  }

  /**
   * @param  {...any} args - Arguments for the Block constructor.
   * 
   * @returns {Block}
   */
  static makeBlock(...args) {
    let bc = Blockchain.getInstance();
    return bc.makeBlock(...args);
  }

  /**
   * @param  {...any} args - Arguments for the Transaction constructor.

   * @returns {Transaction}
   */
  static makeTransaction(...args) {
    let bc = Blockchain.getInstance();
    return bc.makeTransaction(...args);
  }

  /**
   * Get the instance of the blockchain configuration class.
   * 
   * @returns {Blockchain}
   */
  static getInstance() {
    if (!this.instance) {
      throw new Error("The blockchain has not been initialized.");
    }
    return this.instance;
  }

  /**
   * Check if Blockchain instance exists
   * 
   * @returns {Blockchain}
   */
  static hasInstance() {
    return (this.instance ? true : false);
  }

  /**
   * Creates the new instance of the blockchain configuration, giving the
   * clients the amount of starting gold specified in the clients array.
   * This will also create the genesis block, but will not start mining.
   *
   * @param {Object} cfg - Settings for the blockchain.
   * @param {Class} cfg.blockClass - Implementation of the Block class.
   * @param {Class} cfg.transactionClass - Implementation of the Transaction class.
   * @param {Array} [cfg.clients] - An array of client/miner configurations.
   * @param {String} [cfg.mnemonic] - BIP39 mnemonic which is used to generate client addresses.
   * @param {number} [cfg.powLeadingZeroes] - Number of leading zeroes required for a valid proof-of-work.
   * @param {number} [cfg.coinbaseAmount] - Amount of gold awarded to a miner for creating a block.
   * @param {number} [cfg.defaultTxFee] - Amount of gold awarded to a miner for accepting a transaction,
   *    if not overridden by the client.
   * @param {number} [cfg.confirmedDepth] - Number of blocks required after a block before it is
   *    considered confirmed.
   *
   * @returns {Blockchain} - The blockchain configuration instance.
   */
  static createInstance(cfg) {
    this.instance = new Blockchain(cfg);
    this.instance.genesis = this.makeGenesis();

    return this.instance;
  }


  
  /**
   * Constructor for the Blockchain configuration.  This constructor should not
   * be called outside of the class; nor should it be called more than once.
   *
   * @constructor
   */
  constructor({
    blockClass,
    transactionClass,
    clientClass,
    minerClass,
    powLeadingZeroes = POW_LEADING_ZEROES,
    coinbaseReward = COINBASE_AMT_ALLOWED,
    defaultTxFee = DEFAULT_TX_FEE,
    confirmedDepth = CONFIRMED_DEPTH,
    clients = [],
    mnemonic,
    net,
  }) {

    if (this.constructor.instance) {
      throw new Error("The blockchain has already been initialized.");
    }

    // Storing details on classes.
    if (blockClass) {
      this.blockClass = blockClass;
    } else {
      this.blockClass = require('./block');
    }
    if (transactionClass) {
      this.transactionClass = transactionClass;
    } else {
      this.transactionClass = require('./transaction');
    }
    if (clientClass) {
      this.clientClass = clientClass;
    } else {
      this.clientClass = require('./client');
    }
    if (minerClass) {
      this.minerClass = minerClass;
    } else {
      this.minerClass = require('./miner');
    }

    this.clients = [];
    this.miners = [];
    this.clientAddressMap = new Map();
    this.clientNameMap = new Map();
    this.net = net;

    this.powLeadingZeroes = powLeadingZeroes;
    this.coinbaseReward = coinbaseReward;
    this.defaultTxFee = defaultTxFee;
    this.confirmedDepth = confirmedDepth;

    this.powTarget = POW_BASE_TARGET >> BigInt(powLeadingZeroes);

    this.initialBalances = new Map();

    // generate random mnemonic if mnemonic not passed
    if (mnemonic === undefined){
      const { generateMnemonic } = require('bip39');
      this.mnemonic = generateMnemonic(256);
    }
    else{
      this.mnemonic = mnemonic;
    }

    clients.forEach((clientCfg) => {
      console.log(`Adding client ${clientCfg.name}`);
      let client;
      if (clientCfg.mining) {
        client = new this.minerClass({
          name: clientCfg.name,
          password: clientCfg.password ? clientCfg.password : clientCfg.name+'_pswd',
          net: this.net,
          miningRounds: clientCfg.miningRounds,
        });
        client.generateAddress(this.mnemonic);
        // Miners are stored as both miners and clients.
        this.miners.push(client);
      } else {
        client = new this.clientClass({
          name: clientCfg.name,
          password: clientCfg.password ? clientCfg.password : clientCfg.name+'_pswd',
          net: this.net,
        });
        client.generateAddress(this.mnemonic);
      }

      this.clientAddressMap.set(client.address, client);
      if (client.name) this.clientNameMap.set(client.name, client);

      this.clients.push(client);
      this.net.register(client);

      this.initialBalances.set(client.address, clientCfg.amount);
    });

    this.difficultyAdjustmentInterval = 10; // Adjust difficulty every 10 blocks
    this.targetBlockTime = 300; // Target block time in seconds (e.g., 5 minutes)
    this.POW_TARGET = POW_BASE_TARGET;
    this.blockTimes = [];

  }


  addBlock(block) {
    this.blockTimes.push(block.timestamp);
    this.adjustDifficulty();
  }

  // Calculate average block time over the adjustment interval
  calculateBlockProductionRate() {
    if (this.blockTimes.length < this.difficultyAdjustmentInterval) {
      return this.targetBlockTime; // Use target block time if insufficient data
    }

    const recentBlockTimes = this.blockTimes.slice(-this.difficultyAdjustmentInterval);
    const totalTime = recentBlockTimes[this.difficultyAdjustmentInterval - 1] - recentBlockTimes[0];
    return totalTime / this.difficultyAdjustmentInterval;
  }

  // Adjust mining difficulty based on block production rate
  adjustDifficulty() {
    console.log(`Adjusting Difficulty...`);

    const averageBlockTime = this.calculateBlockProductionRate();
    const adjustmentFactor = averageBlockTime / this.targetBlockTime;

    console.log(`Adjustment Factor of ${adjustmentFactor}`);
    // Determine if difficulty should be adjusted
    if (adjustmentFactor < 0.5) {
      console.log(`Increasing Difficulty...`);
      this.increaseDifficulty(); // Difficulty too low: increase target
    } else if (adjustmentFactor > 2) {
      console.log(`Decreasing Difficulty...`);
      this.decreaseDifficulty(); // Difficulty too high: decrease target
    }
    console.log(`No Adjustment Needed For Now`);
  }

  // Increase mining difficulty (make target smaller)
  increaseDifficulty() {
    this.POW_TARGET = this.POW_TARGET / 2n; // Example: halve the target
    console.log(`Mining difficulty increased. New TARGET: ${this.POW_TARGET}`);
  }

  // Decrease mining difficulty (make target larger)
  decreaseDifficulty() {
    this.POW_TARGET = this.POW_TARGET * 2n; // Example: double the target
    console.log(`Mining difficulty decreased. New TARGET: ${this.POW_TARGET}`);
  }



  /**
   * Prints out the balances from one client's view of the blockchain.  A
   * specific client may be named; if no client name is specified, then the
   * first client in the clients array is used.
   * 
   * @param {string} [name] - The name of the client whose view
   *    of the blockchain will be used.
   */
  showBalances(name) {
    let client = name ? this.clientNameMap.get(name) : this.clients[0];
    if (!client) throw new Error("No client found.");
    client.showAllBalances();
  }

  /**
   * Tells all miners to start mining new blocks.
   * 
   * @param {number} [ms] - Delay in milliseconds before the blockchain
   *    terminates.  If omitted, the program will run indefinitely.
   * @param {Function} [f] - Callback function that will be executed when the
   */
  start(ms, f) {
    this.miners.forEach((miner) => {
      miner.initialize();
    });

    if (ms) {
      setTimeout(() => {
        if (f) f();
        process.exit(0);
      }, ms);
    }
  }

  /**
   * @param  {...any} args - Parameters for the Block constructor.
   * 
   * @returns {Block}
   */
  makeBlock(...args) {
    return new this.blockClass(...args);
  }

  /**
   * @param {*} o - Either an object with the transaction details, o an
   *    instance of the Transaction class.
   * 
   * @returns  {Transaction}
   */
  makeTransaction(o) {
    if (o instanceof this.transactionClass) {
      return o;
    } else {
      return new this.transactionClass(o);
    }
  }

  /**
   * Looks up clients by name, returning a list of the matching clients.
   * 
   * @param  {...string} names - Names of all clients to return.
   * 
   * @returns {Array} - An array of clients
   */
  getClients(...names) {
    let clients = [];
    names.forEach((clientName) => {
      clients.push(this.clientNameMap.get(clientName));
    });
    return clients;
  }

  register(...clients) {
    clients.forEach((client) => {
      this.clientAddressMap.set(client.address, client);
      if (client.name) this.clientNameMap.set(client.name, client);

      // Add client to the list of clients and (if a miner) the list of miners.
      this.clients.push(client);
      if (client instanceof this.minerClass) this.miners.push(client);

      // Set the "network" connection for the client.
      client.net = this.net;
      this.net.register(client);
    });
  }

  getClientName(address) {
    if (!this.clientAddressMap.has(address)) {
      return;
    }
    let client = this.clientAddressMap.get(address);
    return client.name;
  }
};

