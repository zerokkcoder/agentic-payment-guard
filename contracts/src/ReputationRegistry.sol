// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityForReputation {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/// @title ReputationRegistry
/// @notice Self-deployed ERC-8004 Reputation Registry reference implementation. Feedback is
///         revocable, self-feedback is rejected, and summaries require the caller to name the
///         client addresses they trust (Sybil resistance).
contract ReputationRegistry is Ownable {
    struct Feedback {
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        bool revoked;
        uint64 index;
    }

    IIdentityForReputation public identityRegistry;

    mapping(uint256 agentId => Feedback[]) private _feedback;
    mapping(uint256 agentId => mapping(address client => uint64[] indexes)) private _byClient;
    mapping(uint256 agentId => mapping(address client => mapping(uint64 index => string responseURI))) private _responses;

    event FeedbackGiven(uint256 indexed agentId, uint256 indexed feedbackIndex, address indexed client, int128 value);
    event FeedbackRevoked(uint256 indexed agentId, uint256 indexed feedbackIndex, address indexed client);
    event ResponseAppended(uint256 indexed agentId, address indexed client, uint64 feedbackIndex, string responseURI);

    error NotInitialized();
    error SelfFeedbackNotAllowed();
    error NotClient();
    error NotAuthorized();
    error IndexOutOfRange();

    constructor() Ownable(msg.sender) {}

    function initialize(address identityRegistry_) external onlyOwner {
        require(identityRegistry_ != address(0), "zero registry");
        identityRegistry = IIdentityForReputation(identityRegistry_);
    }

    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        _requireRegistry();
        address agentOwner = identityRegistry.ownerOf(agentId);
        if (msg.sender == agentOwner || identityRegistry.isApprovedForAll(agentOwner, msg.sender)) {
            revert SelfFeedbackNotAllowed();
        }
        uint64 index = uint64(_feedback[agentId].length);
        _feedback[agentId].push(Feedback(
            msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash, false, index
        ));
        _byClient[agentId][msg.sender].push(index);
        emit FeedbackGiven(agentId, index, msg.sender, value);
    }

    function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2)
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)
    {
        require(clientAddresses.length > 0, "clients required");
        _requireRegistryView();
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            uint64[] memory indexes = _byClient[agentId][clientAddresses[i]];
            for (uint256 j = 0; j < indexes.length; j++) {
                Feedback storage f = _feedback[agentId][indexes[j]];
                if (f.revoked) continue;
                if (bytes(tag1).length > 0 && !_eq(f.tag1, tag1)) continue;
                if (bytes(tag2).length > 0 && !_eq(f.tag2, tag2)) continue;
                count++;
                summaryValue += f.value;
                summaryValueDecimals = f.valueDecimals > summaryValueDecimals ? f.valueDecimals : summaryValueDecimals;
            }
        }
    }

    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) external view returns (Feedback[] memory result) {
        _requireRegistryView();
        uint256 total;
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            total += _byClient[agentId][clientAddresses[i]].length;
        }
        result = new Feedback[](total);
        uint256 n;
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            uint64[] memory indexes = _byClient[agentId][clientAddresses[i]];
            for (uint256 j = 0; j < indexes.length; j++) {
                Feedback storage f = _feedback[agentId][indexes[j]];
                if (!includeRevoked && f.revoked) continue;
                if (bytes(tag1).length > 0 && !_eq(f.tag1, tag1)) continue;
                if (bytes(tag2).length > 0 && !_eq(f.tag2, tag2)) continue;
                result[n++] = f;
            }
        }
        assembly {
            mstore(result, n)
        }
    }

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (Feedback memory)
    {
        _requireRegistryView();
        uint64[] memory indexes = _byClient[agentId][clientAddress];
        for (uint256 i = 0; i < indexes.length; i++) {
            if (indexes[i] == feedbackIndex) return _feedback[agentId][feedbackIndex];
        }
        revert IndexOutOfRange();
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage f = _feedback[agentId][feedbackIndex];
        if (f.client != msg.sender) revert NotClient();
        f.revoked = true;
        emit FeedbackRevoked(agentId, feedbackIndex, msg.sender);
    }

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32
    ) external {
        _requireRegistry();
        address agentOwner = identityRegistry.ownerOf(agentId);
        if (msg.sender != agentOwner && !identityRegistry.isApprovedForAll(agentOwner, msg.sender)) {
            revert NotAuthorized();
        }
        _responses[agentId][clientAddress][feedbackIndex] = responseURI;
        emit ResponseAppended(agentId, clientAddress, feedbackIndex, responseURI);
    }

    function getResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (string memory)
    {
        return _responses[agentId][clientAddress][feedbackIndex];
    }

    function _requireRegistry() private view {
        if (address(identityRegistry) == address(0)) revert NotInitialized();
    }

    function _requireRegistryView() private view {
        _requireRegistry();
    }

    function _eq(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
