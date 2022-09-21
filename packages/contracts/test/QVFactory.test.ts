import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployContract } from "ethereum-waffle";
import { isAddress } from "ethers/lib/utils";
import { artifacts, ethers, upgrades } from "hardhat";
import { Artifact } from "hardhat/types";
import {
  QVFactory,
  QVFactory__factory,
  QVImplementation,
  VoterRegister,
} from "../typechain";
import { BigNumber, utils, Wallet } from "ethers";
import { AddressZero } from "@ethersproject/constants";

const encoder = new utils.AbiCoder();

const encodeParameters = (
  _voteCredits: number,
  _voterRegister: string,
  _adminRoles: string[],
  _roundOperators: string[]
): string => {
  return encoder.encode(
    ["tuple(uint256, address, address[], address[])"],
    [[_voteCredits, _voterRegister, _adminRoles, _roundOperators]]
  );
};

describe("QVFactory", () => {
  let user: SignerWithAddress;

  // QV Factory
  let qvFactory: QVFactory;
  // eslint-disable-next-line camelcase
  let qvContractFactory: QVFactory__factory;

  // QV Implementation
  let qvImplementation: QVImplementation;
  let qvImplementationArtifact: Artifact;

  // Voter Register
  let VoterRegister: VoterRegister;
  let VoterRegisterArtifact: Artifact;

  describe("constructor", () => {
    it("QVFactory SHOULD deploy properly", async () => {
      [user] = await ethers.getSigners();

      qvContractFactory = await ethers.getContractFactory("QVFactory");
      qvFactory = <QVFactory>await qvContractFactory.deploy();

      // Verify deploy
      // eslint-disable-next-line no-unused-expressions
      expect(isAddress(qvFactory.address), "Failed to deploy QVFactory").to.be
        .true;
    });
  });

  describe("core functions", () => {
    beforeEach(async () => {
      [user] = await ethers.getSigners();

      // Deploy QVFactory contract
      qvContractFactory = await ethers.getContractFactory("QVFactory");
      qvFactory = <QVFactory>await upgrades.deployProxy(qvContractFactory);

      // Deploy QVImplementation contract
      qvImplementationArtifact = await artifacts.readArtifact(
        "QVImplementation"
      );
      qvImplementation = <QVImplementation>(
        await deployContract(user, qvImplementationArtifact, [])
      );
      console.log(qvImplementation);
      // Deploy Voter register contract
      VoterRegisterArtifact = await artifacts.readArtifact("VoterRegister");
      VoterRegister = <VoterRegister>(
        await deployContract(user, VoterRegisterArtifact, [
          "TEST",
          "TEST",
          "TEST",
        ])
      );
    });
  });

  describe("test: updateQVContract", async () => {
    it("QVContract SHOULD have default address after deploy ", async () => {
      expect(await qvFactory.qvContract()).to.be.equal(AddressZero);
    });

    // TODO: Test the non-zero address
    it("QVContract SHOULD emit after invoking updateQVContract", async () => {
      qvFactory.initialize();
      expect(qvFactory.connect(user).updateQVContract(AddressZero))
        .to.emit(qvFactory, "QVContractUpdated")
        .withArgs(AddressZero);
    });

    // TODO: Test the non-zero address
    it("QVContract SHOULD be updated after updateQVContract", async () => {
      await qvFactory.updateQVContract(AddressZero);
      const qvContract = await qvFactory.qvContract();
      expect(qvContract).to.be.equal(AddressZero);
    });
  });

  describe("test: create", () => {
    it("QVContract SHOULD create a new implementation of qv", async () => {
      const encodedParams = encodeParameters(
        100,
        AddressZero,
        [user.address],
        [user.address]
      );
      const txn = await qvFactory.create(encodedParams, AddressZero);
      const receipt = await txn.wait();
      // eslint-disable-next-line no-unused-expressions
      expect(txn.hash).to.not.be.empty;
      expect(receipt.status).equals(1);
    });
    it("QVContract SHOULD emit QVCreated after invoking create", async () => {
      const encodedParams = encodeParameters(
        100,
        AddressZero,
        [user.address],
        [user.address]
      );
      const txn = await qvFactory.create(encodedParams, AddressZero);

      expect(txn).to.emit(qvFactory, "QVCreated");
    });
  });
});
