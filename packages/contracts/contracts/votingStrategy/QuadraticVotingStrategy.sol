// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "../utils/Math.sol";
import "./IVotingStrategy.sol";

/**
 * @notice Contract deployed per Round which would be managed by
 * a group of ROUND_OPERATOR
 *
 */
contract QuadraticVotingStrategy is
    IVotingStrategy,
    AccessControlEnumerable,
    Initializable
{
    using Address for address;

    /**
     * @notice Emitted when the voter badge is updated
     */
    event VoterRegisterUpdated(
        address indexed oldVoterRegister,
        address indexed newVoterRegister
    );

    /**
     * @notice Emited when a voter votes for a grantee
     */
    event Voted(
        address indexed voterAddress,
        bytes32 indexed grantID,
        uint256 indexed voteCredits,
        uint256 votes
    );

    event InitializedQV(
        uint256 indexed voteCredits,
        address indexed voterRegister
    );
    /**
     * @dev Round operator role
     */
    bytes32 public constant ROUND_OPERATOR_ROLE = keccak256("ROUND_OPERATOR");

    /**
     * @notice The voters initial vote credit amount
     */
    uint256 public voteCredits;

    /**
     * @notice The voter register contract
     */
    address public voterRegister;

    /**
     * @notice Vote data storage
     */
    bytes[] public votesData;

    /**
     * @notice Mapping of voter address to vote credits used.
     */
    mapping(address => uint256) public voteCreditsUsed;

    /**
     * @notice Instantiates a new QV contract
     * @param encodedParameters Encoded parameters for program creation
     * @dev encodedParameters
     *  - _voteCredits Vote credits allocated to each voter
     *  - _voterBadge Voter badge address
     *  - _adminRoles Addresses to be granted DEFAULT_ADMIN_ROLE
     *  - _roundOperators Addresses to be granted ROUND_OPERATOR_ROLE
     */
    function initialize(bytes calldata encodedParameters) external initializer {
        // Decode _encodedParameters
        (
            uint256 _voteCredits,
            address _voterRegister,
            address[] memory _adminRoles,
            address[] memory _roundOperators
        ) = abi.decode(
                encodedParameters,
                (uint256, address, address[], address[])
            );
        // require(_voterRegister != address(0), "NO");
        voteCredits = _voteCredits;
        voterRegister = _voterRegister;

        // Assigning default admin role
        for (uint256 i = 0; i < _adminRoles.length; ++i) {
            _grantRole(DEFAULT_ADMIN_ROLE, _adminRoles[i]);
        }

        // Assigning round operators
        for (uint256 i = 0; i < _roundOperators.length; ++i) {
            _grantRole(ROUND_OPERATOR_ROLE, _roundOperators[i]);
        }
        emit InitializedQV(_voteCredits, _voterRegister);
    }

    /**
     * @notice Update voter badge (only by ROUND_OPERATOR_ROLE)
     * @param newVoterRegister New voter badge
     */
    function updateVoterRegister(address newVoterRegister)
        external
        onlyRole(ROUND_OPERATOR_ROLE)
    {
        // require(newVoterRegister != address(0), "NO");
        emit VoterRegisterUpdated(voterRegister, newVoterRegister);
        voterRegister = newVoterRegister;
    }

    /**
     * @notice Invoked by RoundImplementation which allows
     * a voter to cast votes to multiple grants during a round
     *
     * @dev
     * - this would be triggered when a voter casts their vote via round explorer
     *
     * @param encodedVotes encoded list of votes
     * @param voterAddress voter address
     */
    function vote(bytes[] calldata encodedVotes, address voterAddress)
        external
        override
    {
        require(
            IERC721(voterRegister).balanceOf(voterAddress) > 0,
            "NOT_REGISTERED"
        );
        if (IERC721(voterRegister).balanceOf(voterAddress) <= 0) 
            revert("NOT_REGISTERED");
        require(
            voteCreditsUsed[voterAddress] < voteCredits,
            "INSUFFICIENT_CREDITS"
        );
        for (uint256 i = 0; i < encodedVotes.length; i++) {
            (bytes32 grantID, uint256 voteCredits) = abi.decode(
                encodedVotes[i],
                (bytes32, uint256)
            );
            require(
                (voteCreditsUsed[voterAddress] + voteCredits) < voteCredits,
                "INSUFFICIENT_CREDITS"
            );
            uint256 votes = Math.sqrt(voteCredits);
            voteCreditsUsed[voterAddress] += voteCredits;
            votesData.push(
                abi.encode(voterAddress, grantID, voteCredits, votes)
            );
            emit Voted(voterAddress, grantID, voteCredits, votes);
        }
    }
}
