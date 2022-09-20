import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployContract } from "ethereum-waffle";
import { isAddress } from "ethers/lib/utils";
import { artifacts, ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { QVFactory, QVImplementation, VoterRegister } from "../typechain";
import { BigNumber, utils } from "ethers";

describe("QVFactory", function () {
  let user0: SignerWithAddress;
  let user1: SignerWithAddress;
  let QVFactory: QVFactory;
  let QVFactoryArtifact: Artifact;
  let QVImplementation: QVImplementation;
  let QVImplementationArtifact: Artifact;
  let VoterRegister: VoterRegister;
  let VoterRegisterArtifact: Artifact;
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

  describe("constructor", () => {
    it("deploys properly", async () => {
      [user0, user1] = await ethers.getSigners();

      QVFactoryArtifact = await artifacts.readArtifact("QVFactory");
      QVFactory = <QVFactory>await deployContract(user0, QVFactoryArtifact, []);

      // Verify deploy
      // eslint-disable-next-line no-unused-expressions
      expect(isAddress(QVFactory.address), "Failed to deploy QVFactory").to.be
        .true;
    });
  });

  describe("core functions", () => {
    before(async () => {
      [user0, user1] = await ethers.getSigners();

      // Deploy QVFactory contract
      QVFactoryArtifact = await artifacts.readArtifact("QVFactory");
      QVFactory = <QVFactory>await deployContract(user0, QVFactoryArtifact, []);

      QVFactory.initialize();
      // Deploy QVImplementation contract
      QVImplementationArtifact = await artifacts.readArtifact(
        "QVImplementation"
      );
      QVImplementation = <QVImplementation>(
        await deployContract(user0, QVImplementationArtifact, [])
      );

      // Deploy Voter register contract
      VoterRegisterArtifact = await artifacts.readArtifact("VoterRegister");
      VoterRegister = <VoterRegister>(
        await deployContract(user0, VoterRegisterArtifact, [
          "TEST",
          "TEST",
          "TEST",
        ])
      );
    });

    // Update QVImplementation contract address in QVFactory
    describe("test: updateQVContract", () => {
      it("should update qv contract address", async () => {
        expect(QVFactory.updateQVContract(QVImplementation.address))
          .to.emit(QVFactory, "QVContractUpdated")
          .withArgs(QVImplementation.address);
      });
    });

    describe("test: create", () => {
      // it("should create a new implementation of qv", async () => {
      //   console.log(VoterRegister.address);
      //   const encodedParams = encodeParameters(
      //     100,
      //     VoterRegister.address,
      //     [user0.address],
      //     [user0.address]
      //   );
      //   await QVFactory.create(encodedParams, user0.address);
      // await expect(QVFactory.create(encodedParams, user1.address)).to.emit(
      //   QVFactory,
      //   "QVCreated"
      // );
      // });
    });
  });
});
