const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
//iport dotenv
require('dotenv').config();

// import Aave pool contract ABI
const AavePoolABI = require('../ABIs/AavePoolABI');

// pool addresses based on mode
let AavePoolAddress;
const mode = process.env.MODE;

if (mode === 'testnet') {
  AavePoolAddress = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"; /// Sepolia address
} else if (mode === 'mainnet') {
  AavePoolAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; /// Mainnet address
}
// module to mock contract calls
const { deployMockContract } = require('@ethereum-waffle/mock-contract');

let PoolAddressProviderTestnet = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"; // Testnet address
let AavePoolAddressTestnet = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"; /// Sepolia address
let AaveUiPoolDataProviderV3AddressTestnet = "0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE" // Testnet address

const ListOfBorrowers = ["0x2d60041eb25979d0017a1702f8e3b9759822b905", "0x2e9f15487862afc0c1ffa7e86d32c9cbc7023122"];


describe("BrazoEjecutor", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const BrazoEjecutor = await ethers.getContractFactory("BrazoEjecutor");
    const brazoEjecutor = await BrazoEjecutor.deploy(AavePoolAddressTestnet, AaveUiPoolDataProviderV3AddressTestnet, PoolAddressProviderTestnet);

    // mock Aave pool contract
    const mockContract = await deployMockContract(owner, AavePoolABI, {
      address: AavePoolAddress,
      overrride: false // optional, specifies if the contract should be overwritten
    })
    return { brazoEjecutor, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should show the correct owner", async function () {
      const { brazoEjecutor, owner } = await loadFixture(deployOneYearLockFixture);
      console.log("owner: ", await brazoEjecutor.getOwner());
      expect(await brazoEjecutor.owner()).to.equal(owner.address);
      
    });


    it("Should return an array of address, even if they're empty", async function () {
      const { brazoEjecutor } = await loadFixture(deployOneYearLockFixture);
      console.log("areLiquidatable: ", await brazoEjecutor.areLiquidatable(ListOfBorrowers));
      // expect the type fo response to be an array
      expect(await brazoEjecutor.areLiquidatable(ListOfBorrowers)).to.be.an('array');
      
    });

    it("Should return the User Reserves Data", async function () {
      const { brazoEjecutor } = await loadFixture(deployOneYearLockFixture);
      // expect the type fo response to be an array
      console.log("getUserReservesData: ", await brazoEjecutor.getUserReservesData(ListOfBorrowers));
      expect(await brazoEjecutor.areLiquidatable(ListOfBorrowers)).to.be.an('array');
      
    });
  });



  // describe("Withdrawals", function () {
  //   describe("Validations", function () {
  //     it("Should revert with the right error if called too soon", async function () {
  //       const { lock } = await loadFixture(deployOneYearLockFixture);

  //       await expect(lock.withdraw()).to.be.revertedWith(
  //         "You can't withdraw yet"
  //       );
  //     });

  //     it("Should revert with the right error if called from another account", async function () {
  //       const { lock, unlockTime, otherAccount } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       // We can increase the time in Hardhat Network
  //       await time.increaseTo(unlockTime);

  //       // We use lock.connect() to send a transaction from another account
  //       await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
  //         "You aren't the owner"
  //       );
  //     });

  //     it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
  //       const { lock, unlockTime } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       // Transactions are sent using the first signer by default
  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw()).not.to.be.reverted;
  //     });
  //   });

  //   describe("Events", function () {
  //     it("Should emit an event on withdrawals", async function () {
  //       const { lock, unlockTime, lockedAmount } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw())
  //         .to.emit(lock, "Withdrawal")
  //         .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
  //     });
  //   });

  //   describe("Transfers", function () {
  //     it("Should transfer the funds to the owner", async function () {
  //       const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw()).to.changeEtherBalances(
  //         [owner, lock],
  //         [lockedAmount, -lockedAmount]
  //       );
  //     });
  //   });
  // });
});
