// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../contracts/BrazoEjecutor.sol";
//import "ds-test/test.sol";
import "../lib/forge-std/src/Test.sol";
//import console.sol
import "../lib/forge-std/src/console.sol";
//import uniswap v3 factory
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
//import uniswap v3 router
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

//import uniswap v3 pool actions IUniswapV3PoolActions.sol
import "@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolActions.sol";

contract brazoEjecutorTest2 is Test {

    BrazoEjecutor brazoEjecutor;

    address PoolAddressessProvider = 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e; // 
    address AavePoolAddress = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2; // 
    address AaveUiPoolDataProviderV3Address = 0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d; // 
    address UniswapV3SwapRouter = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // 
    address priceOracle = 0x54586bE62E3c3580375aE3723C145253060Ca0C2; // 

    address[] users  = [makeAddr("randomAddress[0]")//0xa614ad92390Ca4F540DfA2a6FA4c88aFd01fec14 //
    , makeAddr("randomAddress[1]")];

    // uniswap router address mainnet
        
    ISwapRouter UniswapRouterMainnet = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    address WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // dai and weth mainnet addresses
    address DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F; 
    address USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // dai and weth mainnet addresses
    IERC20 dai = IERC20(DAI);
    IWETH weth = IWETH(WETH);
    IERC20 usdc = IERC20(USDC);

    function setUp() public {
        // create and select fork
        uint256 ForkMainnet = vm.createSelectFork("https://eth-mainnet.g.alchemy.com/v2/ML1RtE7EY8GwFp9u1-gGeJNcbVqhllQp");
        assertEq(vm.activeFork(), ForkMainnet);

        // deploy contract
        brazoEjecutor = new BrazoEjecutor(
            AavePoolAddress, 
            AaveUiPoolDataProviderV3Address,
            PoolAddressessProvider,
            UniswapV3SwapRouter
        );

        // FUND ACCOUNTS
        // deal(address(dai), users[0], 100 ether);
        deal(address(dai), users[1], 100 ether);
        deal(address(weth), users[0], 100 ether);
        deal(address(weth), users[1], 100 ether);
        deal(users[0], 100 ether);
        deal(users[1], 100 ether);
        

        // fund brazoEjecutor with some ETH
        deal(address(brazoEjecutor), 100 * 1e18); // ETH


        // get some weth to the users[0] and approve pool to spend tokens
        vm.startPrank(users[0]);
        weth.approve(AavePoolAddress, type(uint256).max);
        dai.approve(AavePoolAddress, type(uint256).max);
        vm.stopPrank();

        //approve aave pool to spend DAI for users[1] and approve pool to spend tokens
        vm.startPrank(users[1]);
        dai.approve(AavePoolAddress, type(uint256).max);
        weth.approve(AavePoolAddress, type(uint256).max);
        vm.stopPrank();
    }

    function get_hf() private view returns (uint256) {
        (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        ) = IPool(AavePoolAddress).getUserAccountData(users[0]);
        return healthFactor;
    }
    function testExecuteSwap() public {
               

        console.log("balance weth before: ", weth.balanceOf(users[0]));
        console.log("balance dai before: ", dai.balanceOf(users[0]));

        //approve trading Uniswap pool to spend tokens
        vm.startPrank(users[0]);
        weth.approve(address(UniswapRouterMainnet), type(uint256).max);
        dai.approve(address(UniswapRouterMainnet), type(uint256).max);
        vm.stopPrank();

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(weth),
            tokenOut: address(dai),
            fee: 3000,
            recipient: users[0],
            deadline: block.timestamp + 1000,
            amountIn: 10 * 1e18,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        

        // execute swap
        vm.prank(users[0]);
        uint256 aountsOut = UniswapRouterMainnet.exactInputSingle(params);

        console.log("balance weth after: ", weth.balanceOf(users[0]));
        console.log("balance dai after: ", dai.balanceOf(users[0]));
        //console.log("Amounts out: ", aountsOut);
    }

    // We need to test the Liquidate function
    function testLiquidate() public {

        // users[0] supplies 10 WETH
        vm.prank(users[0]);
        IPool(AavePoolAddress).supply(WETH, 1 * 1e18, users[0], 0);

        // Set WETH price
        vm.mockCall(
            priceOracle,
            abi.encodeCall(IAaveOracle.getAssetPrice, (WETH)),
            abi.encode(uint256(3000 * 1e8))
        );

        //check and print the weth balance of users[0] and users[1]
        console.log("WETH balance of users[0] after supply: ", weth.balanceOf(users[0]));
        console.log("DAI balance of users[0] after supply: ", dai.balanceOf(users[0]));

        vm.prank(users[0]);
        IPool(AavePoolAddress).borrow({
            asset: DAI,
            amount: 1500 * 1e18,
            interestRateMode: 2,
            referralCode: 0,
            onBehalfOf: users[0]
        });

        // balance of dai after borrowing
        console.log("DAI balance of users[0] after borrowing: ", dai.balanceOf(users[0]));

        // mock a function call response to the price oracle so that the health factor is less than 1e18
        vm.mockCall(
            priceOracle,
            abi.encodeCall(IAaveOracle.getAssetPrice, (WETH)),
            abi.encode(uint256(1000 * 1e8))
        );

        skip(1);

        console.log("Health factor: ", get_hf());

        assertLt(get_hf(), 0.95 * 1e18, "hf >= 0.95");
        // call are liquidatable to get the liquidatable addresses
        address[] memory liquidatableAddresses = brazoEjecutor.areLiquidatable(users);

        console.log("Liquidatable addresses: ", liquidatableAddresses[0]);
        assertEq(liquidatableAddresses.length, 1);
        // get users[1] debt asset balance before liquidation
        uint256 users1DebtAssetBalanceBefore = dai.balanceOf(users[1]);
        // ger users[1] collateral(weth) asset balance before liquidation
        uint256 users1CollateralAssetBalanceBefore = weth.balanceOf(users[1]);

        vm.prank(users[1]);
        // liquidate users[0] debt
        brazoEjecutor.liquidate(
            WETH,
            DAI,
            users[0],
            500 * 1e18
        );

        // get users[1] debt asset balance after liquidation
        uint256 users1DebtAssetBalanceAfter = dai.balanceOf(users[1]);
        // ger users[1] collateral(weth) asset balance after liquidation
        uint256 users1CollateralAssetBalanceAfter = weth.balanceOf(users[1]);

        console.log("User1DebtAssetBalanceBefore: ", users1DebtAssetBalanceBefore);
        console.log("User1DebtAssetBalanceAfter:  ", users1DebtAssetBalanceAfter);
        console.log("User1CollateralAssetBalanceBefore: ", users1CollateralAssetBalanceBefore);
        console.log("User1CollateralAssetBalanceAfter:  ", users1CollateralAssetBalanceAfter);

        



    }


    // end of contract --------------------------------
}


interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}


interface IDebtToken {
    function approveDelegation(address delegatee, uint256 amount) external;
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}