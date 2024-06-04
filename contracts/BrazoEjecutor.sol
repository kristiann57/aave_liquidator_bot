// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/periphery-v3/contracts/misc/interfaces/IUiPoolDataProviderV3.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';


import "../lib/forge-std/src/console.sol"; // remove after testing

contract BrazoEjecutor {
    IPool private pool;
    IUiPoolDataProviderV3 private uiPoolDataProvider;
    IPoolAddressesProvider immutable PoolAddressesProvider;
    address public owner;

    ISwapRouter public immutable swapRouter;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    struct UserReserveData { // necessary to get the returned values from getUserReservesData
    address underlyingAsset;
    uint256 scaledATokenBalance;
    bool usageAsCollateralEnabledOnUser;
    uint256 stableBorrowRate;
    uint256 scaledVariableDebt;
    uint256 principalStableDebt;
    uint256 stableBorrowLastUpdateTimestamp;
    }

    constructor(address _pool, address uiPoolDataProviderAddress,address _PoolAddressesProvider, address _swapRouter) {
        pool = IPool(_pool);
        uiPoolDataProvider = IUiPoolDataProviderV3(uiPoolDataProviderAddress);
        owner = msg.sender;
        PoolAddressesProvider = IPoolAddressesProvider(_PoolAddressesProvider);
        swapRouter = ISwapRouter(_swapRouter);
    }

    function getOwner() external view returns (address) {
        return owner;
    }

    function areLiquidatable(address[] calldata addressesList) external view onlyOwner returns (address[] memory)  {
        address[] memory tempAddresses = new address[](addressesList.length);
        uint256 count = 0;

        for (uint256 i = 0; i < addressesList.length; i++) {
            (, , , , , uint256 healthFactor) = pool.getUserAccountData(addressesList[i]);
            if (healthFactor < 1e18) {
                tempAddresses[count] = addressesList[i];
                count++;
            }
        }

        address[] memory liquidatableAddresses = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            liquidatableAddresses[i] = tempAddresses[i];
        }

        return liquidatableAddresses; //uncomment
    }

    function getUserReservesData(address[] calldata addressesList) external view onlyOwner returns (IUiPoolDataProviderV3.UserReserveData[][] memory) {
        IUiPoolDataProviderV3.UserReserveData[][] memory userReservesData = new IUiPoolDataProviderV3.UserReserveData[][](addressesList.length);
        uint8 someValue;
        
        for (uint256 i = 0; i < addressesList.length; i++) {
            (userReservesData[i], someValue) = uiPoolDataProvider.getUserReservesData(PoolAddressesProvider, addressesList[i]);
        }
        return userReservesData;
    }   

    //liquidate an address
    // collateral asset is the underlying asset used by the user as collateral 
    // debt asset is the underlying asset used by the user as debt, the one they borrowed
    // liquidatableUser is the address of the user to be liquidated
    function liquidate(
        address collateralAsset,
        address debtAsset,
        address liquidatableUser,
        uint256 debtToCover
     ) external { // @audit-issue add onlyOwner
        // get the balance of the collateral asset
        uint256 collateralBalanceBefore = IERC20(collateralAsset).balanceOf(address(this));
        // get debtAsset balance before liquidation
        uint256 debtBalanceBefore = IERC20(debtAsset).balanceOf(address(this));

        console.log("LIQ: Collateral balance before FL & liquidation: ", collateralBalanceBefore); // *************** remove after testing
        // first we need to get a flash loan of the debt asset
        // then we need to call the liquidationCall function
        // the liquidationCall function will swap the debt asset for the collateral asset
        // the liquidationCall function will also pay the debt of the user
        // we need to makre sure that at the end of the function, our contract has enough debt asset to pay the flash loan
        // make sure we have profit from the liquidation

        // prepare the data to be passed to the flashloan receiver
        bytes memory data = abi.encode(collateralAsset, liquidatableUser, debtToCover);

        console.log("LIQ: Asset balance before flashloan: ", IERC20(debtAsset).balanceOf(address(this))); // *************** remove after testing

        // execute the flashloan
        pool.flashLoanSimple(address(this), debtAsset, debtToCover + 10000000, data, 0);// the amount is the amount to be paid to Aave for the debt asset

        // get the balance of the collateral asset after the liquidation
        uint256 collateralBalanceAfter = IERC20(collateralAsset).balanceOf(address(this));
        uint256 debtBalanceAfter = IERC20(debtAsset).balanceOf(address(this));
        console.log("LIQ: collateral balance after liquidation: ", collateralBalanceAfter); // *************** remove after testing
        console.log("LIQ: Asset balance after liquidation: ", debtBalanceAfter); // *************** remove after testing

        // require balance after liquidation to be greater than balance before liquidation
        require(collateralBalanceAfter > collateralBalanceBefore, "Liquidation failed, no profit"); // balace after should be greater than balance before

        // send the profit to the owner
        TransferHelper.safeTransfer(collateralAsset, msg.sender, collateralBalanceAfter);  // @audit-issue change msg.sender to owner  

    }

    function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
  ) external returns (bool) {
        {
            console.log("EXEC: Asset balance after flashloan: ", IERC20(asset).balanceOf(address(this))); // *************** remove after testing
        }
        
        // function called by Aavepool when flashloan Simple is executed
        // ensure only the pool can call this function
        require(msg.sender == address(pool), "Only Aave pool can call this function");
        // get the data from the params
        (address collateralAsset, 
        address liquidatableUser, 
        uint256 debtToCover) = abi.decode(params, (address, address, uint256));
        // approve the pool to spend the debt asset for the liquidation
        IERC20(asset).approve(address(pool), debtToCover);
    
        console.log("EXEC: Debt to cover: ", debtToCover); // *************** remove after testing
        console.log("EXEC: Collateral asset: ", collateralAsset); // *************** remove after testing
        console.log("EXEC: collateral balance before liquidation: ", IERC20(collateralAsset).balanceOf(address(this))); // *************** remove after testing

        // call the liquidation function, this will swap the debt asset for the collateral asset
        pool.liquidationCall(collateralAsset, asset, liquidatableUser, debtToCover, false);    

        // exchange the collateral asset for the debt asset to pay the flash loan
        uint256 collateralBalance = IERC20(collateralAsset).balanceOf(address(this));
        console.log("EXEC: Collateral balance after liquidation: ", collateralBalance); // *************** remove after testing

        // approve the Uniswap router to spend ALL the collateral asset
        TransferHelper.safeApprove(collateralAsset, address(swapRouter), collateralBalance);

        // Minimum amount of debt asset to receive = amount + premium + 1 percent of the amount
        uint256 amountOutMinimum = amount + premium;
        console.log("EXEC: Amount Asset out minimum: ", amountOutMinimum); // *************** remove after testing

        

        
        
        {
            // swap the collateral asset received for the debt asset, use the exactOutputSingle function instead of the exactInputSingle

            uint256 amountOut = swapRouter.exactOutputSingle(
                ISwapRouter.ExactOutputSingleParams({
                    tokenIn: collateralAsset,
                    tokenOut: asset,
                    fee: 3000,
                    recipient: address(this),
                    deadline: block.timestamp + 60,
                    amountOut: amountOutMinimum - 10000000, // "10000000" represent the extra 10000000 wei I asked for in the flashloan
                    amountInMaximum: (collateralBalance * 98) / 100 , // 98% of the collateral balance 
                    sqrtPriceLimitX96: 0
                })
            );

            // // swap the collateral asset for the debt asset - params set up:
            // uint256 amountOut = swapRouter.exactInputSingle(
            //     ISwapRouter.ExactInputSingleParams({
            //         tokenIn: collateralAsset,
            //         tokenOut: asset,
            //         fee: 3000,
            //         recipient: address(this),
            //         deadline: block.timestamp + 60,
            //         amountIn: collateralBalance,
            //         amountOutMinimum: 0, //amountOutMinimum, **** uncomment this line
            //         sqrtPriceLimitX96: 0
            //     })
            // );
        
            console.log("EXEC: Amount out after swapping collaterall received for debt to pay FL: ", amountOut); // ***** remove after testing
            console.log("EXEC: Actual asset amount: ", IERC20(asset).balanceOf(address(this))); // ***** remove after testing

            // approve aave pool to spend the amount of debt asset + premium
            IERC20(asset).approve(address(pool), amount + premium);

            return true;
        }
    }

    
    //end of contract
}
