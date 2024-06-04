const { ethers } = require("ethers");
const Redis = require("ioredis");
// import dotenv from "dotenv";
require('dotenv').config()

// ABI's
// import uipooldataproviderv3
const AaveUiPoolDataProviderV3ABI = require('./ABIs/AaveUiPoolDataProviderV3ABI');

//import Pool data provider ABI (formerly Protocol data provider)
const PoolDataProviderABI = require('./ABIs/PoolDataProviderABI');

// import AavePriceOracleABI
const AavePriceOracleABI = require('./ABIs/AavePriceOracleABI');

// valriables based on MODES
const mode = process.env.MODE;
let URL;
let AaveUiPoolDataProviderV3Address;
let PoolAddressProvider;
let PoolDataProviderAddress; // (formerly Protocol data provider)
let DB_PRICES;

if (mode === 'testnet') {
    URL = process.env.RPC_URL_TESTNET;
    AaveUiPoolDataProviderV3Address = "0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE";
    PoolAddressProvider = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"; // Testnet address
    PoolDataProviderAddress = "0x3e9708d80f7B3e43118013075F7e95CE3AB31F31" // Testnet 
    DB_PRICES = process.env.DB_PRICES_TESTNET; // Select DB 5
    priceOracle = "0x2da88497588bf89281816106C7259e31AF45a663"; // Testnet address
} else if (mode === 'mainnet') {
    URL = process.env.RPC_URL_MAINNET;
    AaveUiPoolDataProviderV3Address = "0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d"; 
    PoolAddressProvider = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"; // Mainnet address
    PoolDataProviderAddress = "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3" // Mainnet address
    DB_PRICES = process.env.DB_PRICES_MAINNET; // Select DB 4
    priceOracle = "0x54586bE62E3c3580375aE3723C145253060Ca0C2"; // Mainnet address used by Aave
} else if (mode === 'mainnetOP') {
    URL = process.env.RPC_URL_OPTIMISM_MAINNET;
    AaveUiPoolDataProviderV3Address = "0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5" // Mainnet OP address
    PoolAddressProvider = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb"; // Mainnet OP address
    PoolDataProviderAddress = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654" // mainnet OP address
    DB_PRICES = process.env.DB_PRICES_OPTIMISM_MAINNET; // Select DB 8
    priceOracle = "0xD81eb3728a631871a7eBBaD631b5f424909f0c77"; // MMainnet OP address
}

console.log("URL: ", URL);

// Connect to Ethereum network
const provider = new ethers.providers.JsonRpcProvider(URL);


 // Get UIPoolDataProviderV3 contract instance
 const  AaveUiPoolDataProviderV3Contract = new ethers.Contract(AaveUiPoolDataProviderV3Address, AaveUiPoolDataProviderV3ABI, provider);

// initialize the AavePriceOracle contract
const AAVE_PRICE_ORACLE_CONTRACT = new ethers.Contract(priceOracle, AavePriceOracleABI, provider);

// get pool data provider contract instance (formerly Protocol data provider)
const  AavePoolDataProviderV3Contract = new ethers.Contract(PoolDataProviderAddress, PoolDataProviderABI, provider);

// Connect to Redis
// Redis connection options
const redisOptions = {
    host: "localhost",
    port: 6379,
    db: DB_PRICES, // Redis DB 4
};

// Connect to Redis
const redis = new Redis(redisOptions);

async function fetchPriceData() {
    
    
    // Get assets list
    const assetsList = await AaveUiPoolDataProviderV3Contract.getReservesList(PoolAddressProvider);
    console.log(assetsList);

    while (true) {
        for (let i = 0; i < assetsList.length; i++) {
            const asset = assetsList[i];
            let assetPrice = await AAVE_PRICE_ORACLE_CONTRACT.getAssetPrice(asset);

            
            console.log(assetPrice.toString());

            // get reserve configuration data
            const reserveConfig = await AavePoolDataProviderV3Contract.getReserveConfigurationData(asset);
            
            // get the decimals for the asset
            const decimals = reserveConfig.decimals;
            console.log(asset, "decimals: ",decimals.toString());

            // store the price and decimals in Redis as hash
            await redis.hset(asset, 'price', assetPrice.toString(), 'decimals', decimals.toString());

            console.log("confirmation: ", await redis.hgetall(asset));


        }
        // Wait 1 minute before fetching again
        await new Promise((resolve) => setTimeout(resolve, 60000));
    }

}

fetchPriceData();