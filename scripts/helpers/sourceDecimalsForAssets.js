const { ethers } = require("ethers");
const Redis = require("ioredis");
// import dotenv from "dotenv";
require('dotenv').config()

// ABI's
// import uipooldataproviderv3
const AaveUiPoolDataProviderV3ABI = require('../ABIs/AaveUiPoolDataProviderV3ABI');

//import Pool data provider ABI (formerly Protocol data provider)
const PoolDataProviderABI = require('../ABIs/PoolDataProviderABI');

// valriables based on MODES
const mode = process.env.MODE;
let URL;
let AaveUiPoolDataProviderV3Address;
let DB_BONUS;
let PoolAddressProvider;
let PoolDataProviderAddress; // (formerly Protocol data provider)

if (mode === 'testnet') {
    URL = process.env.RPC_URL_TESTNET;
    AaveUiPoolDataProviderV3Address = "0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE";
    DB_BONUS = process.env.DB_BONUS_TESTNET; // Select DB 3
    PoolAddressProvider = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"; // Testnet address
    PoolDataProviderAddress = "0x3e9708d80f7B3e43118013075F7e95CE3AB31F31" // Testnet address
} else if (mode === 'mainnet') {
    URL = process.env.RPC_URL_MAINNET;
    AaveUiPoolDataProviderV3Address = "0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d"; 
    DB_BONUS = process.env.DB_BONUS_MAINNET; // Select DB 1
    PoolAddressProvider = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"; // Mainnet address
    PoolDataProviderAddress = "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3" // Mainnet address
} else if (mode === 'mainnetOP') {
    URL = process.env.RPC_URL_OPTIMISM_MAINNET;
    AaveUiPoolDataProviderV3Address = "0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5" // Mainnet OP address
    DB_BONUS = process.env.DB_BONUS_OPTIMISM_MAINNET; // Select DB 7
    PoolAddressProvider = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb"; // Mainnet OP address
    PoolDataProviderAddress = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654" // mainnet OP address
}

// Redis connection options
const redisOptions = {
    host: "localhost",
    port: 6379,
    db: DB_BONUS, // Redis DB 4
};

// Connect to Redis
const redis = new Redis(redisOptions);

// Connect to Ethereum network
const provider = new ethers.providers.JsonRpcProvider(URL);


// Function to query Aave Protocol Data Provider contract
async function queryAaveDataProvider() {
    // get pool data provider contract instance (formerly Protocol data provider)
    const  AavePoolDataProviderV3Contract = new ethers.Contract(PoolDataProviderAddress, PoolDataProviderABI, provider);

    // Get UIPoolDataProviderV3 contract instance
    const  AaveUiPoolDataProviderV3Contract = new ethers.Contract(AaveUiPoolDataProviderV3Address, AaveUiPoolDataProviderV3ABI, provider);

    // Get assets list
    const assetsList = await AaveUiPoolDataProviderV3Contract.getReservesList(PoolAddressProvider);

    // Loop through assets
    for (const asset of assetsList) {
        // Query decimals for each asset
        const reserveConfig = await AavePoolDataProviderV3Contract.getReserveConfigurationData(asset);
        const decimals = reserveConfig.decimals;
        const liquidationBonus = reserveConfig.liquidationBonus;

        console.log(asset, "decimals: ",reserveConfig.decimals.toString());
        console.log("liquidation Bonus: ",reserveConfig.liquidationBonus.toString() );

        // uncomment to save delete original data and save a new hash object again
        await redis.del(asset)

        await redis.hset(asset, 'decimals', decimals, 'liquidationBonus', liquidationBonus)

        const object = await redis.hgetall(asset)

        console.log(object);
        console.log("Decimals: ", object.decimals);
        console.log("Liquidation Bonus: ", object.liquidationBonus);
    }

    // Disconnect from Redis
    redis.disconnect();
}

// Call the function
queryAaveDataProvider().catch((error) => {
    console.error(error);
});