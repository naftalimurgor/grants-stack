import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployContract } from "ethereum-waffle";
import { isAddress } from "ethers/lib/utils";
import { artifacts, ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { QuadraticVotingStrategy, VoterRegister } from "../typechain";
import { BigNumber, utils } from "ethers";

describe("QuadraticVotingStrategy", function () {
  let user0: SignerWithAddress;
  let user1: SignerWithAddress;
  let QuadraticVotingStrategy: QuadraticVotingStrategy;
  let QVImplementationArtifact: Artifact;
  let VoterRegisterArtifact: Artifact;
  let VoterRegister: VoterRegister;
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

  const encodeVote = (grantID: string, voteCredits: number): string => {
    return encoder.encode(
      ["tuple(bytes32, uint256)"],
      [[grantID, voteCredits]]
    );
  };

  describe("constructor", () => {
    it("QVContract SHOULD deploy properly", async () => {
      [user0, user1] = await ethers.getSigners();

      QVImplementationArtifact = await artifacts.readArtifact(
        "QuadraticVotingStrategy"
      );
      QuadraticVotingStrategy = <QuadraticVotingStrategy>(
        await deployContract(user0, QVImplementationArtifact, [])
      );

      // Verify deploy
      // eslint-disable-next-line no-unused-expressions
      expect(
        isAddress(QuadraticVotingStrategy.address),
        "Failed to deploy QuadraticVotingStrategy"
      ).to.be.true;
    });
  });

  describe("core functions", () => {
    before(async () => {
      [user0, user1] = await ethers.getSigners();

      // Deploy QuadraticVotingStrategy contract
      QVImplementationArtifact = await artifacts.readArtifact(
        "QuadraticVotingStrategy"
      );
      QuadraticVotingStrategy = <QuadraticVotingStrategy>(
        await deployContract(user0, QVImplementationArtifact, [])
      );

      VoterRegisterArtifact = await artifacts.readArtifact("VoterRegister");
      VoterRegister = <VoterRegister>(
        await deployContract(user0, VoterRegisterArtifact, [
          "TEST",
          "TEST",
          "TEST",
          [user0.address, user1.address]
        ])
      );

      const encodedParams = encodeParameters(
        100,
        VoterRegister.address,
        [user0.address],
        [user0.address]
      );
      QuadraticVotingStrategy.initialize(encodedParams);
    });

    describe("test: vote", () => {
      it("QVContract SHOULD allow a registered user to vote", () => {
        // mint the voter register
        VoterRegister.register(user0.address);

        const encodedVotes = [
          encodeVote(
            "0x657468657265756d000000000000000000000000000000000000000000000000",
            10
          ),
          encodeVote(
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            4
          ),
        ];
        QuadraticVotingStrategy.vote(encodedVotes, user0.address);
      });
      it("QVContract SHOULD prevent unregistered users from voting", () => {
        const encodedVotes = [
          encodeVote(
            "0x657468657265756d000000000000000000000000000000000000000000000000",
            10
          ),
        ];
        // eslint-disable-next-line no-unused-expressions
        expect(QuadraticVotingStrategy.vote(encodedVotes, user1.address)).to.be
          .reverted;
      });
      it("QVContract SHOULD emit an event on vote", async () => {
        // mint the voter register
        VoterRegister.register(user1.address);

        const encodedVotes = [
          encodeVote(
            "0x657468657265756d000000000000000000000000000000000000000000000000",
            16
          ),
        ];
        expect(QuadraticVotingStrategy.vote(encodedVotes, user1.address))
          .to.emit(QuadraticVotingStrategy, "Voted")
          .withArgs(
            user1.address,
            "0x657468657265756d000000000000000000000000000000000000000000000000",
            BigNumber.from(16),
            BigNumber.from(4)
          );
      });
    });
  });
});
