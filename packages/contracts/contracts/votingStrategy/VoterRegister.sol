// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Voter Badge contract
 * @notice Badge contract is a minimalist soulbound ERC-721 implementation
 * @author GITCOIN
 */
contract VoterRegister is ERC721, Ownable {


    /**
     * @notice Emitted when a voter is added to the whitelist
     */
    event VoterAdded(address indexed voterAddress);

    /**
     * @notice BaseURI of the NFT
     */
    string public baseURI;

    /**
     * @notice Total supply of the NFT
     */
    uint256 public totalSupply;

    /**
     * @notice Maps from the address to the voter status.
     */
    mapping(address => bool) public isVoter;

    /**
     * @notice Modifier that prevents callers other than an Voters from calling the function.
     */
    modifier onlyVoter() {
        require(isVoter[msg.sender], "VoterRegister: Invalid Voter");
        _;
    }

    /**
     * @param _name Name of the NFT
     * @param _symbol Symbol of the NFT
     * @param _baseURI BaseURI of the NFT
     * @param _voterAddress Addresses of the voters to be whitelisted
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address[] memory _voterAddress
    ) payable ERC721(_name, _symbol) {
        baseURI = _baseURI;
        for (uint256 i = 0; i < _voterAddress.length; i++) {
            isVoter[_voterAddress[i]] = true;
            emit VoterAdded(_voterAddress[i]);
        }
    }

    /**
     * @notice Whitelists voters
     * @notice Only the owner can add voters to the whitelist.
     *
     * @param _voterAddress Address of the voters
     */
    function addVoters(address[] calldata _voterAddress) external onlyOwner {
        for (uint256 i = 0; i < _voterAddress.length; i++) {
            isVoter[_voterAddress[i]] = true;
            emit VoterAdded(_voterAddress[i]);
        }
    }

    /**
     * @notice Registering mints a soulbound voter badge NFT which gives voting access for a given round.
     * @notice Only a whitelisted voter can register. 
     *
     * @param _voterAddress Address of the voter
     */
    function register(address _voterAddress) external onlyVoter {
        _mint(_voterAddress, totalSupply++);
    }

    /**
     * @notice Burns the soulbound voter badge NFT.
     *
     * @param _id The token ID of the NFT
     */
    function burn(uint256 _id) external onlyVoter {
        require(ownerOf(_id) == msg.sender, "VoterRegister: Invalid Voter");
        _burn(_id);
    }

    /**
     * @notice Withdraw the contract ETH balance
     */
    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    /**
     * @notice Returns the the tokenURI for given NFT token ID.
     *
     * @param _id The token ID of the NFT
     */
    function tokenURI(uint256 _id) public view override returns (string memory) {
        return string(abi.encodePacked(baseURI, _id));
    }

    /**
     * @notice Make the Badge Soul Bound
     * @notice Override the ERC721 transferFrom method to revert
     */
    function transferFrom(
        address,
        address,
        uint256
    ) public pure override {
        revert("SOULBOUND");
    }

    /**
     * @notice Override the ERC721 Approve method to revert
     */
    function approve(address, uint256) public pure override {
        revert("SOULBOUND");
    }

    /**
     * @notice Override the ERC721 setApprovalForAll method to revert
     */
    function setApprovalForAll(address, bool) public pure override {
        revert("SOULBOUND");
    }

    /**
     * @notice ERC165 interface check function
     *
     * @param _interfaceId Interface ID to check
     *
     * @return Whether or not the interface is supported by this contract
     */
    function supportsInterface(bytes4 _interfaceId) public pure override returns (bool) {
        bytes4 iface1 = type(IERC165).interfaceId;
        return _interfaceId == iface1;
    }
}
