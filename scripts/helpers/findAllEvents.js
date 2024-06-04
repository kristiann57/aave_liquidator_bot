const ethers = require('ethers');
const AavePoolABI = require('../ABIs/AavePoolABI.js');
// import dotenv from 'dotenv';
require('dotenv').config()
//import ioredis
const Redis = require('ioredis');


// last transaction hash: 0xca393747901587fbb562f0492bce3429e667cfa2ee2edcf409c34a1e4562fabd
// last block number: 117757207

// Addresses based on mode
const mode = process.env.MODE;
let AavePoolAddress;
let RPC_URL;
let DB_BORRWERS;

if (mode === 'testnet') {
    AavePoolAddress = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"; /// Sepolia address
    RPC_URL = process.env.RPC_URL_TESTNET;
    DB_BORRWERS = Number(process.env.DB_BORROWERS_TESTNET); // Select DB 2
    
} else if (mode === 'mainnet') {
    AavePoolAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; /// Mainnet address
    RPC_URL = process.env.RPC_URL_MAINNET;
    DB_BORRWERS = Number(process.env.DB_BORROWERS_MAINNET); // Select DB 0
} else if (mode === 'mainnetOP') {
    AavePoolAddress = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; /// Mainnet OP address
    RPC_URL = process.env.RPC_URL_OPTIMISM_MAINNET;
    DB_BORRWERS = Number(process.env.DB_BORROWERS_OPTIMISM_MAINNET); // Select DB 7
}

////////////////////////////////////////////
// PROVIDER, CONTRACT & SIGNATURES ///////// 
////////////////////////////////////////////

// Initialize a provider
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Initialize the pool contract
const POOL_CONTRACT = new ethers.Contract(AavePoolAddress, AavePoolABI, provider);

// Repay and Borrow events sugnature
const repayEventSignature = ethers.utils.id("Repay(address,address,address,uint256,bool)");
const borrowEventSignature = ethers.utils.id("Borrow(address,address,address,uint256,uint8,uint256,uint16)");
console.log(repayEventSignature);

////////////////////////////////////////////
// REDIS DATABASE ////////////////////////// 
////////////////////////////////////////////

// Create a Redis client and connect to the Redis server
// Connect to Redis
const client = new Redis({
    port: 6379, // Redis port
    host: 'localhost', // Redis host
    db: DB_BORRWERS, // Select DB 2
});

async function setKey(addressBorrower) {
    await client.set(addressBorrower, 'true');
    console.log("Key set for", addressBorrower);
}
////////////////////////////////////////////
// LOGIC /////////////////////////////////// 
////////////////////////////////////////////

// Get all events function
async function getEventsRecursive(contract, _from, _to) {
    try {
        const events = await contract.queryFilter(contract.filters.Borrow(), _from, _to);
        console.log("Found", events.length, "events between blocks", _from, "and", _to);
        return events;
    } catch (error) {
        if (error.code === 'SERVER_ERROR') {
            console.log("Too many events found between blocks", _from, "and", _to);
            const midBlock = Math.floor((_from + _to) / 2);
            const firstHalf = await getEventsRecursive(contract, _from, midBlock);
            const secondHalf = await getEventsRecursive(contract, midBlock + 1, _to);
            return firstHalf.concat(secondHalf);
        } else if (error.error && error.error.code === -32005) {
            console.log("Too many events found between blocks", _from, "and", _to);
            const midBlock = Math.floor((_from + _to) / 2);
            const firstHalf = await getEventsRecursive(contract, _from, midBlock);
            const secondHalf = await getEventsRecursive(contract, midBlock + 1, _to);
            return firstHalf.concat(secondHalf);
        }
        else {
            // Handle other errors
            console.error("An error occurred:", error);
            throw error;
        }
    }
}

// get the tx hash from the user and find out the events in the tx
// if repay event is there in the tx, then discard the tx
// if the reay event is not in the tx, we can save the data in the db
// do it
async function filterOutFlashloans(events) {
    let eventsFinal = [];
     // loop throuhg the events, extract the tx hash and check if the repay event is there in the tx
    // if it is there, discard the tx, if not, save the data to eventsFinal array
    for (let i = 0; i < events.length; i++) {
        const txHash = events[i].transactionHash;
        //Initialize the txLogs variables before the try block
        let txLogs;
        let tx;
        try {
            tx = await provider.getTransactionReceipt(txHash);
            txLogs = tx.logs;
        } catch (error) {
            console.error("An error occurred:", error);
            continue;
        }
        

        // our of all of these logs, find out the event that represents the repay event
        // if it is there, discard the tx, if not, save the data to the database
        
        const repayEvent = txLogs.find(log => log.topics[0] === repayEventSignature);
        
               
        
        if (repayEvent) {
            console.log("Discarding transaction. Repay event found.");
            console.log(repayEvent);
        } else {
            // check if key already exist in the Database and if not, then save it
            // I believe when ou borrow, ou can borrow on behalf of someone else, how do we handle that?
            // looping though all events looking for the borrow event to extract the address of the borrower
            const borrowEvent = txLogs.find(log => log.topics[0] === borrowEventSignature);

            const addressBorrower = '0x' + borrowEvent.topics[2].slice(-40);
            console.log(addressBorrower); // REMOVE THIS LINE AFTER TESTING ***************************
            
            const keyExist = await client.get(addressBorrower); // based in the borrow event we stracted the address of the borrower
            if (!keyExist) {
                console.log("Transaction is valid. Saving data to the database.");
                eventsFinal.push(events[i]);
                await setKey(addressBorrower);
            } else {
                console.log("Discarding transaction. Borrower already has a transaction in the database.");
            }
        }
    }    
    console.log("Found a total of", eventsFinal.length, "valid events");
}


async function main() {
    const events = await getEventsRecursive(POOL_CONTRACT, 0, 117757761);
    const eventsFinal = await filterOutFlashloans(events);
    console.log("Found a total of", events.length, "events");

    // losing REDIS client
    await client.quit();

}

main();