const ethers = require('ethers');
//import ioredis
const Redis = require('ioredis');
// import the dotenv package
require('dotenv').config();
// import big number from ethers
const { BigNumber } = require('ethers');


////////////////////////////////////////////
// ABI's ///////////////////////////////////
////////////////////////////////////////////

const AavePoolABI = require('../ABIs/AavePoolABI');
//import the JSON file containing the ABI of the BrazoEjecutor contract
const BrazoEjecutorABI = require('../ABIs/BrazoEjecutorABI');
const AaveUiPoolDataProviderV3ABI = require('../ABIs/AaveUiPoolDataProviderV3ABI');
// import AavePriceOracleABI
const AavePriceOracleABI = require('../ABIs/AavePriceOracleABI');


////////////////////////////////////////////
// Contracts & provider initialization //////
////////////////////////////////////////////


// Addresses based on mode
const mode = process.env.MODE;
let AavePoolAddress;
let RPC_URL;
let AaveUiPoolDataProviderV3Address;
let PoolAddressProvider;
let DB_BONUS;
let DB_BORRWERS;
let UniswapV3SwapRouter;
let priceOracle;
let BrazoEjecutorAddress;
let DB_PRICES;

if (mode === 'testnet') {
    AavePoolAddress = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"; /// Sepolia address
    RPC_URL = process.env.RPC_URL_TESTNET;
    AaveUiPoolDataProviderV3Address = "0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE" // Testnet address
    PoolAddressProvider = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"; // Testnet address
    DB_BONUS = process.env.DB_BONUS_TESTNET; // Select DB 3
    DB_BORRWERS = process.env.DB_BORRWERS_TESTNET; // Select DB 2
    UniswapV3SwapRouter = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"; // Testnet address
    priceOracle = "0x2da88497588bf89281816106C7259e31AF45a663"; // Testnet address
    BrazoEjecutorAddress = process.env.BRAZO_EJECUTOR_TESTNET;
    DB_PRICES = process.env.DB_PRICES_TESTNET; // Select DB 5
} else if (mode === 'mainnet') {
    AavePoolAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; /// Mainnet address
    RPC_URL = process.env.RPC_URL_MAINNET;
    AaveUiPoolDataProviderV3Address = "0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d" // Mainnet address
    PoolAddressProvider = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"; // Mainnet address
    DB_BONUS = process.env.DB_BONUS_MAINNET; // Select DB 1
    DB_BORRWERS = process.env.DB_BORRWERS_MAINNET; // Select DB 0
    UniswapV3SwapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Mainnet address
    priceOracle = "0x54586bE62E3c3580375aE3723C145253060Ca0C2"; // Mainnet address used by Aave
    DB_PRICES = process.env.DB_PRICES_MAINNET; // Select DB 4
}

// Initialize a provider
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Initialize ethers Wallet
const signer = new ethers.Wallet(process.env.PRIV_KEY, provider);
console.log('Wallet address:', signer.address);

// Initialize the pool contract
const POOL_CONTRACT = new ethers.Contract(AavePoolAddress, AavePoolABI, provider);

//initialize the BrazoEjecutor contract
const BRAZO_EJECUTOR_CONTRACT = new ethers.Contract(BrazoEjecutorAddress, BrazoEjecutorABI, provider);
const BRAZO_EJECUTOR_CONTRACT_WITH_SIGNER = BRAZO_EJECUTOR_CONTRACT.connect(signer);

// initialize the AaveUiPoolDataProviderV3 contract
const AAVE_UI_POOL_DATA_PROVIDER_V3_CONTRACT = new ethers.Contract(AaveUiPoolDataProviderV3Address, AaveUiPoolDataProviderV3ABI, provider);

// initialize the AavePriceOracle contract
const AAVE_PRICE_ORACLE_CONTRACT = new ethers.Contract(priceOracle, AavePriceOracleABI, provider);

// LIQUIDATION DATA
const DEFAULT_LIQUIDATION_CLOSE_FACTOR = BigNumber.from("5000") ; // 0.5e4;
const MAX_LIQUIDATION_CLOSE_FACTOR = BigNumber.from("10000"); // 1e4
const CLOSE_FACTOR_HF_THRESHOLD = BigNumber.from("950000000000000000") // 0.95e18; 
const BASE_MULTIPLIER = BigNumber.from("10000");

////////////////////////////////////////////
// INIT REDIS DATABASE ///////////////////// 
////////////////////////////////////////////

// Create a Redis client and connect to the Redis server
// Connect to Redis
const client = new Redis({
  port: 6379, // Redis port
  host: 'localhost', // Redis host
  db: DB_BORRWERS, // Select the database number
});

const clientBonus = new Redis({
  port: 6379, // Redis port
  host: 'localhost', // Redis host
  db: DB_BONUS, // Database number for the second client, can be the same or different
});

const clientPrices = new Redis({
  port: 6379, // Redis port
  host: 'localhost', // Redis host
  db: DB_PRICES, // Database number for the second client, can be the same or different
});

////////////////////////////////////////////
// FIND COLLATERAL AND DEBT ASSTS ////////// 
////////////////////////////////////////////

// loop through the reserves data, find colalteral & debt assets
//find out debt assets and collateral 

// create object to store the collateral and debt assets asset address and asset amount


function getCollateralAndDebtAssets(userReservesData) {

  let debtAssets = [];
  let collateralAssets = [];
  for(let i = 0; i < userReservesData.length; i++) { // loop through the reserves data, find colalteral & debt assets
    //if user is using an asset as collateral and debt at the same time, we need to handle this case
    if (userReservesData[i].usageAsCollateralEnabledOnUser == true && (userReservesData[i].scaledVariableDebt > 0 && userReservesData[i].principalStableDebt > 0)) { 
      console.log("GETCOL&DEBASSETS: - WARN:user is using the asset as collateral and debt at the same time. We need to handle this case.");
      console.log("GETCOL&DEBASSETS: strange Case: ", userReservesData[i]);
      continue;
    }

    if (userReservesData[i].usageAsCollateralEnabledOnUser == true) { //if the user is using the asset as collateral
      collateralAssets.push({
        asset: userReservesData[i].underlyingAsset,
        amount: userReservesData[i].scaledATokenBalance
      }); // if user is using the asset as debt

    } else if(userReservesData[i].scaledVariableDebt > 0) { //if the user is borrowing the asset (vriable rate)
      debtAssets.push({
        asset: userReservesData[i].underlyingAsset,
        amount: userReservesData[i].scaledVariableDebt
      });

    } else if (userReservesData[i].principalStableDebt > 0) { //if the user is borrowing the asset (stable rate)
      debtAssets.push({
        asset: userReservesData[i].underlyingAsset,
        amount: userReservesData[i].principalStableDebt
      });
    }
  }
  console.log('GETCOL&DEBASSETS: Collateral assets:', collateralAssets) /// **** REMOVE THIS LINE LATER ****
  console.log('GETCOL&DEBASSETS: Debt assets:', debtAssets) /// **** REMOVE THIS LINE LATER ****

  return [debtAssets, collateralAssets];
}

////////////////////////////////////////////
// GET DEBT AMOUNT TO LIQUIDATE ////////////
////////////////////////////////////////////

function getDebtAmountToLiquidate(debtToLiquidateAmount, HF) {

  console.log('GETDEBTAMTOLIQUIDATE: Debt to potentially be liquidated:', debtToLiquidateAmount.toString()) /// **** REMOVE THIS LINE LATER ****
  console.log('GETDEBTAMTOLIQUIDATE: Health factor:', HF.toString()) /// **** REMOVE THIS LINE LATER ****
  let debtToCover;
  if (HF < CLOSE_FACTOR_HF_THRESHOLD) {
    debtToCover = (debtToLiquidateAmount.mul(MAX_LIQUIDATION_CLOSE_FACTOR)); // Max debt that be cleared by single liquidation call is given by the MAX_LIQUIDATION_CLOSE_FACTOR
    debtToCover = debtToCover.div(10000);
  } else {
    debtToCover = (debtToLiquidateAmount.mul(DEFAULT_LIQUIDATION_CLOSE_FACTOR)); // Max debt that be cleared by single liquidation call is given by the DEFAULT_LIQUIDATION_CLOSE_FACTOR
    debtToCover = debtToCover.div(10000);
  }
  console.log('GETDEBTAMTOLIQUIDATE: Debt to cover:', debtToCover.toString()) /// **** REMOVE THIS LINE LATER ****
  return debtToCover;
}

////////////////////////////////////////////
// GET COLLATERAL AMOUNT TO LIQUIDATE //////
////////////////////////////////////////////

async function getMaxCollaterallAmountToLiquidate(collateralToLiquidate, debtAsset, debtToCover){
  //maxAmountOfCollateralToLiquidate = (debtAssetPrice * debtToCover * liquidationBonus)/ collateralPrice
  // get liquidation bonus from the Redis client database
  const collateralDecimalsAndLB = await clientBonus.hgetall(collateralToLiquidate);
  console.log("DEBUGGING ***************** INSIDE address: ", collateralToLiquidate)
  console.log("DEBUGGING ***************** INSIDE getMaxCollaterallAmountToLiquidate: ", collateralDecimalsAndLB)

  const collateralDecimals = collateralDecimalsAndLB.decimals;
  const liquidationBonus = BigNumber.from(collateralDecimalsAndLB.liquidationBonus); // convert it to a big number

  // find out the decimals of the debt assets
  const debtDecimals = await clientBonus.hgetall(debtAsset); 

  console.log('GETCOLLAMTOLIQUIDATE: Collateral decimals:', collateralDecimals.toString()) /// **** REMOVE THIS LINE LATER ****
  console.log('GETCOLLAMTOLIQUIDATE: Debt decimals:', debtDecimals.decimals.toString()) /// **** REMOVE THIS LINE LATER ****

  console.log('GETCOLLAMTOLIQUIDATE: Liquidation bonus:', liquidationBonus.toString()) /// **** REMOVE THIS LINE LATER ****
  // find out the price of the collateral & debt asset in Aave BASE_CURRENCY (USD)
  let assetsPrice = await AAVE_PRICE_ORACLE_CONTRACT.getAssetsPrices([collateralToLiquidate, debtAsset]);
  console.log('GETCOLLAMTOLIQUIDATE: Assets price:', assetsPrice[0].toString(), assetsPrice[1].toString()) /// **** REMOVE THIS LINE LATER ****
  
  //prep the prices so that they are in the same decimals as the debtToCover 8 to 18
  colPriceDecAdjusted = assetsPrice[0].mul(BigNumber.from(10).pow(10));
  debtPriceDecAdjusted = assetsPrice[1].mul(BigNumber.from(10).pow(10));

  console.log('GETCOLLAMTOLIQUIDATE: debtToCover befor converted: ', debtToCover.toString() ) /// **** REMOVE THIS LINE LATER ****
  // prep the debtToCover so that it has the same decimals as the prices
  if (debtDecimals.decimals < 18) {
    const powExpontent = 18 - debtDecimals.decimals; // find out the difference in decimals
    debtToCover = debtToCover.mul(BigNumber.from(10).pow(powExpontent));
  }

  console.log('GETCOLLAMTOLIQUIDATE: debtToCover after converted: ', debtToCover.toString() ) /// **** REMOVE THIS LINE LATER ****

  // calculate the max amount of collateral to liquidate
  const maxAmountOfCollateralToLiquidate = (
    debtPriceDecAdjusted.mul(debtToCover).mul(liquidationBonus)
    ).div((colPriceDecAdjusted.mul(BASE_MULTIPLIER)));

  console.log( debtPriceDecAdjusted.toString(),"*", debtToCover.toString(), "*", liquidationBonus.toString(),"/", colPriceDecAdjusted.toString() );
  console.log('GETCOLLAMTOLIQUIDATE: Max amount of collateral to liquidate:', maxAmountOfCollateralToLiquidate.toString()) /// **** REMOVE THIS LINE LATER ****
  
  // reutn multiple values and change the names of the variables
  const collateralToLiquidateAmount = maxAmountOfCollateralToLiquidate;
  const collateralAssetPriceUSD = colPriceDecAdjusted;

  return {collateralToLiquidateAmount: maxAmountOfCollateralToLiquidate, 
    liquidationBonus: liquidationBonus, 
    collateralAssetPriceUSD: colPriceDecAdjusted}; // in BigNumber and 18 decimals

}

////////////////////////////////////////////
// ESTIMATE GAS COST ///////////////////////
////////////////////////////////////////////

async function estimateGasCost(collateralAsset, debtAsset,liquidatableUser, debtToCover, gasPrice) {
  // estimate the gas cost of the transaction
  const gasEstimate = await BRAZO_EJECUTOR_CONTRACT_WITH_SIGNER.estimateGas.liquidate(
    collateralAsset, 
    debtAsset, 
    liquidatableUser, 
    debtToCover
    );

  console.log('ESTIMATEGASCOST: Estimated gas units:', gasEstimate.toString()) /// **** REMOVE THIS LINE LATER ****
  console.log('ESTIMATEGASCOST: Gas price:', gasPrice.toString()) /// **** REMOVE THIS LINE LATER ****
  

  const estimatedCost = gasEstimate.mul(gasPrice);
  const estimatedCostInEther = ethers.utils.formatEther(estimatedCost);

  console.log('ESTIMATEGASCOST: Estimated gas cost:', estimatedCostInEther) /// **** REMOVE THIS LINE LATER ****
  console.log('ESTIMATEGASCOST: Estimated gas cost in USD: ', estimatedCostInEther * 4000) /// **** REMOVE THIS LINE LATER ****

  // return the estimated gas cost in ether
  return estimatedCostInEther;

  
}

/////////////////////////////////////////////////////
// FIND OUT DEBT ASSET TO LIQUIDATE MULTIPLE ////////
/////////////////////////////////////////////////////

async function getDebtAssetToLiquidateMultiple(debtAssets) {
  // create list 
  let debtAssetsList = [];

  // find out the price of the debt assets in Aave BASE_CURRENCY (USD), feth it from the Redis database
  for(i = 0; i < debtAssets.length; i++) {
    console.log('GETDEBTASSETTOLIQUIDATEMULTIPLE: Debt asset info:', debtAssets[i].amount.toString()) /// **** REMOVE THIS LINE LATER ****
    const assetInfo = await clientPrices.hgetall(debtAssets[i].asset);
    console.log('GETDEBTASSETTOLIQUIDATEMULTIPLE: Asset info:', assetInfo) /// **** REMOVE THIS LINE LATER ****

    // convert amount to 18 decimals
    let assetAmount;
    if (assetInfo.decimals < 18) {
      const powExpontent = 18 - assetInfo.decimals; // find out the difference in decimals
      assetAmount = debtAssets[i].amount.mul(BigNumber.from(10).pow(powExpontent));
    } else {
      assetAmount = debtAssets[i].amount;
    }

    // find out the price of the debt asset in Aave BASE_CURRENCY (USD)
    const finalAmount = assetAmount.mul(assetInfo.price);

    // remove deciamls (8 + 18 = 26 decimals), 8 from the price and 18 from the amount
    finalAmountAdjusted = finalAmount / 1e26;

    console.log('GETDEBTASSETTOLIQUIDATEMULTIPLE: FInal AMount:', finalAmount.toString()) /// **** REMOVE THIS LINE LATER ****
    console.log('GETDEBTASSETTOLIQUIDATEMULTIPLE: FInal AMount Adjusted:', finalAmountAdjusted.toString()) /// **** REMOVE THIS LINE LATER ****
    
    debtAssetsList.push({
      asset: debtAssets[i].asset, 
      amount: debtAssets[i].amount, 
      comparisionAmount: finalAmountAdjusted, 
    });

    // wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // sort the debt assets by the amount and return the one with the highest amount
  debtAssetsList.sort((a, b) => b.comparisionAmount - a.comparisionAmount);
  console.log('GETDEBTASSETTOLIQUIDATEMULTIPLE: Debt assets list:', debtAssetsList) /// **** REMOVE THIS LINE LATER ****
  return [debtAssetsList[0].asset , debtAssetsList[0].amount]; // return the asset address and the amount of the asset

}

/////////////////////////////////////////////////////
// FIND OUT COLLATERAL ASSET TO LIQUIDATE MULTIPLE //
/////////////////////////////////////////////////////

async function getCollateralAssetToLiquidateMultiple(collateralAssets) {
  // create list
  let collateralAssetsList = [];

  //iterate through the collateral assets and get the liquiation bonus from the Redis database
  // then push the liquidation bonus + the asset address to the list to be sorted later
  for(i = 0; i < collateralAssets.length; i++) {
    const assetInfo = await clientBonus.hgetall(collateralAssets[i].asset);
    console.log('GETCOLLATERALASSETTOLIQUIDATEMULTIPLE: Asset info:', assetInfo) /// **** REMOVE THIS LINE LATER ****

    collateralAssetsList.push({
      asset: collateralAssets[i].asset, 
      liquidationBonus: assetInfo.liquidationBonus, 
    });

    
  }

  // sort the collateral assets by the liquidation bonus and return the one with the highest bonus
  collateralAssetsList.sort((a, b) => b.liquidationBonus - a.liquidationBonus);
  console.log('GETCOLLATERALASSETTOLIQUIDATEMULTIPLE: Collateral assets list:', collateralAssetsList) /// **** REMOVE THIS LINE LATER ****

  // wait for 10 second
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log("************** DEBUGGING!!! address being returned: ", collateralAssetsList[0].asset)
  return collateralAssetsList[0].asset; // return the asset address
}


////////////////////////////////////////////
// FIND OUT PROFITABILITY //////////////////
////////////////////////////////////////////
/// --- NEEDS TO BE ADJUSTED WHEN DEALING WITH MAINNET --- ///
// NEEDS TO BE ABLE TO READ THE REAL ASSET PRICES FROM THE GRAPH (UNISWAP) ////


function isProfitable(maxAmountOfCollateralToLiquidate, liquidationBonus, collateralAssetPriceUSD, estimatedGasCostEth) {
  // max amount of collateral has 18 decimals
  // liquidation bonus has 4 decimals (BASE_MULTIPLIER)
  // find out asset price in ETH
  // multiply collateralPirceUSD by the BASE_MULTIPLIER to add more precision

  // collateralAssetPriceUSDAdjusted = collateralAssetPrice * BASE_MULTIPLIER
  // collateralAssetPriceEth = collateralAssetPriceUSDAdjusted / ethPriceinUSD
  // liquidationBonusMinusOne = liquidationBonus - BASE_MULTIPLIER
  // maxAmountCollateralBonus = maxAmountOfCollateralToLiquidate * liquidationBonusMinusOne * collateralAssetPriceEth
  // maxAmountCollateralBonusAdjusted = maxAmountCollateralBonus / (10^8) // remove 8 decimals
  // maxAmountCollateralBonusEth = maxAmountCollateralBonusAdjusted / 1e18 // from wei to eth
  // maxAmountCollateralBonusUSD = maxAmountCollateralBonusEth * (ethPriceinUSD / 1e18  ) // from eth to USD

  
  const collateralAssetPriceUSDAdjusted = collateralAssetPriceUSD.mul(BASE_MULTIPLIER); // adding decimals to avoid rounding errors
  const ethPriceinUSD = BigNumber.from("4000000000000000000000"); // 4000e18 eth price in USD - this will be repaced by real price from the graph
  const collateralAssetPriceEth = collateralAssetPriceUSDAdjusted.div(ethPriceinUSD);
  const liquidationBonusMinusOne = liquidationBonus.sub(BASE_MULTIPLIER);

  console.log('ISPROFITABLE: Collateral asset price ETH:', collateralAssetPriceEth.toString()) /// **** REMOVE THIS LINE LATER ****
  console.log('ISPROFITABLE: Liquidation bonus minus one:', liquidationBonusMinusOne.toString()) /// **** REMOVE THIS LINE LATER ****

  const maxAmountCollateralBonus = maxAmountOfCollateralToLiquidate.mul(liquidationBonusMinusOne).mul(collateralAssetPriceEth);

  console.log('ISPROFITABLE: Max amount of collateral bonus:', maxAmountCollateralBonus.toString()) /// **** REMOVE THIS LINE LATER ****

  // we need to remove 8 decimals from the maxAmountCollateralBonus BASE_MULTIPLIER (4 decimals)  twice (8 decimals)
  const maxAmountCollateralBonusAdjusted = maxAmountCollateralBonus.div(BigNumber.from(10).pow(8));

  console.log('ISPROFITABLE: Max amount of collateral bonus Adjusted:', maxAmountCollateralBonusAdjusted.toString()) /// **** REMOVE THIS LINE LATER ****
  

  const maxAmountCollateralBonusEth = maxAmountCollateralBonusAdjusted / 1e18; // from wei to eth
  const maxAmountCollateralBonusUSD = maxAmountCollateralBonusEth * (ethPriceinUSD / 1e18); // from eth to USD

  console.log('ISPROFITABLE: Max amount of collateral bonus ETH:', maxAmountCollateralBonusEth.toString()) /// **** REMOVE THIS LINE LATER ****
  console.log('ISPROFITABLE: Max amount of collateral bonus USD:', maxAmountCollateralBonusUSD.toString()) /// **** REMOVE THIS LINE LATER ****
  
  // etimate the gas cost of the transaction
  // --- is it worth checking maxAmountCollateralBonusAdjusted or maxAmountCOllateralBonus directly
  // ----against the estimatedGasCostEth? --- to avoid extra steps .... check in production @audit 
  if (maxAmountCollateralBonusEth > estimatedGasCostEth) {
    return true;
  } else {
    return false;
  }
  
  // return true if profitable, false if not
}


////////////////////////////////////////////
// SCAN & CHECK FOR LIQUIDABLE  LIUIDATE ///
////////////////////////////////////////////

let cursor = '0'; // Initial cursor starts at 0

async function scanAndProcessAddresses() {
    do {
        // Use the SCAN command with the current cursor
        // Replace redisClient with your actual Redis client's method to execute SCAN
        console.log("///////////////////////////////////////////////"); /// **** REMOVE THIS LINE LATER ****
        console.log("///////////////////////////////////////////////"); /// **** REMOVE THIS LINE LATER ****
        console.log('SCAN: Scanning keys...') /// **** REMOVE THIS LINE LATER ****
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', '*', 'COUNT', 200);
        cursor = nextCursor;

        // // get the gas price at the beggining of each main iteration
        let gasPrice = await provider.getFeeData()
        console.log(gasPrice)
        gasPrice = gasPrice.gasPrice; // is a big number
        console.log('SCAN: Gas price:', gasPrice) /// **** REMOVE THIS LINE LATER ****
        console.log('SCAN: Gas price:', gasPrice.toString()) /// **** REMOVE THIS LINE LATER ****
        
        console.log('SCAN: Processing keys:') /// **** REMOVE THIS LINE LATER ****

        // Process the keys
        let liquidatableUsers;
        try {
          liquidatableUsers = await BRAZO_EJECUTOR_CONTRACT_WITH_SIGNER.areLiquidatable(keys);
        } catch (error) {
          console.error(error); 
          continue; // Continue to the next iteration of the loop
        }      

        liquidatableUsers = [liquidatableUsers[0]]; // get the first element of the array

        // Variable to store the collateral and debt assets
        let collateralToLiquidate;
        let collateralToLiquidateAmount;
        let liquidationBonus;
        let collateralAssetPriceUSD;

        let debtToLiquidate;
        let debtToLiquidateAmount;

        // ---- IF TERE'S ONLY ONE LIQUIDATABLE USER -----------------------///
        if (liquidatableUsers.length ==  1) {
          console.log("-------NEW USER ---------"); 
          // ------------ USE TRY - catch IN CASE TX FAILS ---------------- //
          console.log('SCAN: ONE Liquidatable user found. Processing...');
          const userReservesData = await AAVE_UI_POOL_DATA_PROVIDER_V3_CONTRACT.getUserReservesData(PoolAddressProvider, liquidatableUsers[0].user);
          
          //find out debt assets and collateral assets
          const [debtAssets, collateralAssets] = getCollateralAndDebtAssets(userReservesData);

          console.log('SCAN: Collateral assets:', collateralAssets) /// **** REMOVE THIS LINE LATER ****
          console.log('SCAN: Debt assets:', debtAssets) /// **** REMOVE THIS LINE LATER ****

          // IF THERE ARE NO COLLATERAL NOR DEBT ASSETS
          if  (collateralAssets.length == 0 || debtAssets.length == 0) { //if the user has no collateral nor debt assets
            //continue to the next iteration of the loop
            console.log('SCAN: User has no collateral nor debt assets. Continuing...')
            continue;
          } 


          // IF THERE IS ONLY ONE DEBT ASSET
          if (debtAssets.length == 1) {  // if te user has only one debt asset
            debtToLiquidate = debtAssets[0].asset;
            debtToLiquidateAmount = getDebtAmountToLiquidate(debtAssets[0].amount, liquidatableUsers[0].healthFactor);
            console.log('SCAN: Debt to liquidate:', debtToLiquidate) /// **** REMOVE THIS LINE LATER ****
            console.log('SCAN: Debt to liquidate amount:', debtToLiquidateAmount.toString()) /// **** REMOVE THIS LINE LATER ****
          } 
          
          // IF THERE ARE SEVERAL DEBT ASSETS
          else if (debtAssets.length > 1) { //if the user has more than one debt asset
              let originalAmount; // temp variable to store the original amount of the debt asset before passing it to getDebtAmountToLiquidate

              // check the one with heightest price in USD
              console.log("SCAN: DEBT ASSETS!_____________ONE USER___________________________---________");
              [debtToLiquidate, originalAmount] = await getDebtAssetToLiquidateMultiple(debtAssets); // get the address of the debt asset
              debtToLiquidateAmount = getDebtAmountToLiquidate(originalAmount, liquidatableUsers[0].healthFactor);


              console.log('SCAN: (from multiple) Debt to liquidate:', debtToLiquidate) /// **** REMOVE THIS LINE LATER ****
              console.log('SCAN: (from multiple) Debt to liquidate amount:', debtToLiquidateAmount.toString()) /// **** REMOVE THIS LINE LATER ****
          }

          

          // IF THERE IS ONLY ONE COLLATERAL ASSET
          if (collateralAssets.length == 1) { 
            collateralToLiquidate = collateralAssets[0].asset; // get the address of the collateral asset
            ({collateralToLiquidateAmount, liquidationBonus, collateralAssetPriceUSD} = 
              await getMaxCollaterallAmountToLiquidate(collateralToLiquidate, debtToLiquidate, debtToLiquidateAmount));// get the amount of the collateral asset
            
            console.log('SCAN: Collateral to liquidate:', collateralToLiquidate) /// **** REMOVE THIS LINE LATER ****
            console.log('SCAN: Collateral balance aTokens:', collateralAssets[0].amount.toString()) /// **** REMOVE THIS LINE LATER ****
          } 
          
          // IF THERE ARE SEVERAL COLLATERAL ASSETS
          else if (collateralAssets.length > 1) { 
            // check the assesats gains the REDIS database to find out the liquidity bonus of the assets
            // pick the one with the heigest bonus
            console.log("SCAN: COLLATERAL ASSETS!_________________SEVERAL USERS_______________________---________");
            collateralToLiquidate = await getCollateralAssetToLiquidateMultiple(collateralAssets); // get the address of the collateral asset
            
            console.log("Liquidation BONUS DEBUGGING ********------------*********", await clientBonus.hgetall(collateralToLiquidate) );
            
            ({collateralToLiquidateAmount, liquidationBonus, collateralAssetPriceUSD} = 
              await getMaxCollaterallAmountToLiquidate(collateralToLiquidate, debtToLiquidate, debtToLiquidateAmount));// get the amount of the collateral asset
            console.log('SCAN: Collateral(multiple) to liquidate:', collateralToLiquidate) /// **** REMOVE THIS LINE LATER ****
            console.log('SCAN: Collateral(multiple) balance aTokens:', collateralAssets[0].amount.toString()) /// **** REMOVE THIS LINE LATER ****
          }

          // UNCOMMENT IN PRODUCTION, ESTIMATION WILL FAIL AS THERE ANOT POOLS IN UNISWAP TO EXCHANGE THE NEECESARY ASSETS
          // // check if the transaction is profitable
          // const estimatedGasCostEth = await estimateGasCost(
          //   collateralToLiquidate, 
          //   debtToLiquidate, 
          //   liquidatableUsers[0].user, 
          //   debtToLiquidateAmount, 
          //   gasPrice); // estimate the gas cost of the transaction

          const estimatedGasCostEth = 0.0013; // *** REMOVE THIS LINE LATER **** 

          if (isProfitable(collateralToLiquidateAmount, liquidationBonus, collateralAssetPriceUSD, estimatedGasCostEth)) {
            // send the transaction to the BrazoEjecutor contract to liquidate the user
            console.log('SCAN: Transaction is profitable. Sending transaction...') /// **** REMOVE THIS LINE LATER ****
            
          } else {
            //continue to the next iteration of the loop
            console.log('SCAN: Transaction is not profitable. Continuing...') /// **** REMOVE THIS LINE LATER ****
            continue;
          }          
          




          // ------ IF THERE ARE SEVERAL LIQUIDATABLE USERS -----------------------
        } else if (liquidatableUsers.length > 1) { 
          // ------------ USE TRY - catch IN CASE TX FAILS ---------------- //
          console.log('SCAN: more than one liquidatable found. Processing...');

          // if more tha one, lets extract the user out of the liquidatableUsers array
          const liquidatableUsersAddresses = liquidatableUsers.map(user => user.user);

          console.log('SCAN: Users:', liquidatableUsersAddresses) /// **** REMOVE THIS LINE LATER ****

          const usersReservesData = await BRAZO_EJECUTOR_CONTRACT_WITH_SIGNER.getUserReservesData(liquidatableUsersAddresses);
          // console.log('SCAN: User reserves data:', usersReservesData) /// **** REMOVE THIS LINE LATER ****


          // -------- WE WILL NEED TO BENCHMARK: going one user at a time vs all at once and see which one is faster???
          ///////////////// BEGGINING OF THE FOR LOOP //////////////////////////
          /// notes: the debt needs to be selected based on the lowest LTV ratio, but if there's a massive difference in the amount of the debt
          // then we might need to select the one with the highest amount of debt, as it will be more profitable @audit
          for (let i = 0; i < liquidatableUsersAddresses.length; i++) { 
            console.log("-------NEW USER ---------"); 
            const [debtAssets, collateralAssets] = getCollateralAndDebtAssets(usersReservesData[i]);
            
            // IF THERE ARE NO COLLATERAL NOR DEBT ASSETS
            if  (collateralAssets.length == 0 || debtAssets.length == 0) { 
              //continue to the next iteration of the loop
              console.log('SCAN: User has no collateral nor debt assets. Continuing...')
              continue;
            } 

            // IF THE USER HAS ONLY ONE DEBT ASSET
            if (debtAssets.length == 1) {
              debtToLiquidate = debtAssets[0].asset;
              debtToLiquidateAmount = getDebtAmountToLiquidate(debtAssets[0].amount, liquidatableUsers[i].healthFactor);
              console.log('SCAN: Debt to liquidate:', debtToLiquidate) /// **** REMOVE THIS LINE LATER ****
              console.log('SCAN: Debt to liquidate amount:', debtToLiquidateAmount.toString()) /// **** REMOVE THIS LINE LATER ****
            }


            // IF THE USER HAS MORE THAN ONE DEBT ASSET
            else if (debtAssets.length > 1) {
              let originalAmount; // temp variable to store the original amount of the debt asset before passing it to getDebtAmountToLiquidate

              // check the one with heightest price in USD
              console.log("SCAN: DEBT ASSETS!_________________SEVERAL USERS_______________________---________");
              [debtToLiquidate, originalAmount] = await getDebtAssetToLiquidateMultiple(debtAssets); // get the address of the debt asset
              debtToLiquidateAmount = getDebtAmountToLiquidate(originalAmount, liquidatableUsers[i].healthFactor);


              console.log('SCAN: (from multiple) Debt to liquidate:', debtToLiquidate) /// **** REMOVE THIS LINE LATER ****
              console.log('SCAN: (from multiple) Debt to liquidate amount:', debtToLiquidateAmount.toString()) /// **** REMOVE THIS LINE LATER ****
            }



            // IF THE USER HAS ONLY ONE COLLATERAL ASSET
            if (collateralAssets.length == 1) {
              collateralToLiquidate = collateralAssets[0].asset;
              ({collateralToLiquidateAmount, liquidationBonus, collateralAssetPriceUSD} = 
                await getMaxCollaterallAmountToLiquidate(collateralToLiquidate, debtToLiquidate, debtToLiquidateAmount));// get the amount of the collateral asset
              console.log('SCAN: Collateral to liquidate:', collateralToLiquidate) /// **** REMOVE THIS LINE LATER ****
              console.log('SCAN: Collateral balance aTokens:', collateralAssets[0].amount.toString()) /// **** REMOVE THIS LINE LATER ****
            }

            // IF THE USER HAS MORE THAN ONE COLLATERAL ASSET
            else if (collateralAssets.length > 1) {
              // check the assesats gains the REDIS database to find out the liquidity bonus of the assets
              // pick the one with the heigest bonus
              console.log("SCAN: COLLATERAL ASSETS!_________________SEVERAL USERS_______________________---________");
              collateralToLiquidate = await getCollateralAssetToLiquidateMultiple(collateralAssets); // get the address of the collateral asset
              
              console.log("Liquidation BONUS DEBUGGING ********------------*********", await clientBonus.hgetall(collateralToLiquidate) );
              
              ({collateralToLiquidateAmount, liquidationBonus, collateralAssetPriceUSD} = 
                await getMaxCollaterallAmountToLiquidate(collateralToLiquidate, debtToLiquidate, debtToLiquidateAmount));// get the amount of the collateral asset
              console.log('SCAN: Collateral(multiple) to liquidate:', collateralToLiquidate) /// **** REMOVE THIS LINE LATER ****
              console.log('SCAN: Collateral(multiple) balance aTokens:', collateralAssets[0].amount.toString()) /// **** REMOVE THIS LINE LATER ****
            }


            // CHECK IF THE TRANSACTION IS PROFITABLE
            const estimatedGasCostEth = 0.0013; // *** REMOVE THIS LINE LATER **** 

            if (isProfitable(collateralToLiquidateAmount, liquidationBonus, collateralAssetPriceUSD, estimatedGasCostEth)) {
              // send the transaction to the BrazoEjecutor contract to liquidate the user
              console.log('SCAN: Transaction is profitable. Sending transaction...') /// **** REMOVE THIS LINE LATER ****
              
            } else {
              //continue to the next iteration of the loop
              console.log('SCAN: Transaction is not profitable. Continuing...') /// **** REMOVE THIS LINE LATER ****
              continue;
            }          


          } // END OF THE FOR LOOP OF THE USERS





        /// ---- IF THERE ARE NO LIQUIDATABLE USERS -----------------------///
        } else {
          //continue to the next iteration of the do while loop
          console.log('SCAN: No liquidatable users found in this batch. Continuing...');
          //continue;
        }
          // iterate through the liquidatableUsers and getUserReservesData() to check for assets that are being used as collateral/debt

        
            // smart contract to return the last element of getUserAccountData(),health factor, if under 1ETH == user is liquidatable
            // save all users that are liquidatable in a list
            // then go through the list and query the blockchain getUserReservesData() check for assets that are being used as collateral
            // also check what is being borrowed
            // for the liquidation,(in case < 2 collateral) pick the colalteral with heigest liquidity bonus, this can be found out
              // by checking the getConfiguration(asset) and saving a database of liquidity bonusses
            // for the assetDebt you are going to payback (in case there's more than one) check the total collateral vale in eth, 
              // check also the debt assets price in eth, and the go for the one with heger price--- this technique needs to improve
            // once you have all of this, then you can call the liquidation function in our contract using flashbots/or not
            // also we can use promises to send multiple transactions at the same time in case the user has multiple users to liquidate  
            

        // If cursor is '0', it means the scan is complete; start again if needed
        if (cursor === '0') {
            console.log('SCAN: Completed scanning all keys. Starting over...');
            // Optionally, pause before restarting the scan to avoid hammering the Redis server non-stop
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pause for 1 second
        }
    } while (true); // Keep looping indefinitely
}




async function Main() {  
  // Start the scanning and processing
  await scanAndProcessAddresses().catch(console.error);
  
  // Closing REDIS client
  await client.quit();
}

Main();