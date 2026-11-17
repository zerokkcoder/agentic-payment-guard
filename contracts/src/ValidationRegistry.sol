// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityForValidation {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/// @title ValidationRegistry
/// @notice Self-deployed ERC-8004 Validation Registry reference implementation. Validators
///         respond with a 0-100 score, producing an auditable on-chain validation record.
contract ValidationRegistry is Ownable {
    struct Validation {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        string requestURI;
        bytes32 requestHash;
        uint64 lastUpdate;
        bool exists;
    }

    IIdentityForValidation public identityRegistry;

    mapping(bytes32 requestHash => Validation) private _status;
    mapping(uint256 agentId => bytes32[] hashes) private _agentValidations;
    mapping(address validator => bytes32[] hashes) private _validatorRequests;

    event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, bytes32 requestHash);
    event ValidationResponse(bytes32 indexed requestHash, uint256 indexed agentId, address indexed validator, uint8 response);

    error NotInitialized();
    error NotAuthorized();
    error RequestNotFound();
    error NotValidator();
    error InvalidResponse();

    constructor() Ownable(msg.sender) {}

    function initialize(address identityRegistry_) external onlyOwner {
        require(identityRegistry_ != address(0), "zero registry");
        identityRegistry = IIdentityForValidation(identityRegistry_);
    }

    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }

    function validationRequest(address validatorAddress, uint256 agentId, string calldata requestURI, bytes32 requestHash)
        external
    {
        _requireRegistry();
        address agentOwner = identityRegistry.ownerOf(agentId);
        if (msg.sender != agentOwner && !identityRegistry.isApprovedForAll(agentOwner, msg.sender)) {
            revert NotAuthorized();
        }
        Validation storage v = _status[requestHash];
        v.validatorAddress = validatorAddress;
        v.agentId = agentId;
        v.requestURI = requestURI;
        v.requestHash = requestHash;
        v.lastUpdate = uint64(block.timestamp);
        v.exists = true;
        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);
        emit ValidationRequest(validatorAddress, agentId, requestHash);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata,
        bytes32 responseHash,
        string calldata tag
    ) external {
        Validation storage v = _status[requestHash];
        if (!v.exists) revert RequestNotFound();
        if (msg.sender != v.validatorAddress) revert NotValidator();
        if (response > 100) revert InvalidResponse();
        v.response = response;
        v.responseHash = responseHash;
        v.tag = tag;
        v.lastUpdate = uint64(block.timestamp);
        emit ValidationResponse(requestHash, v.agentId, msg.sender, response);
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory requestURI,
            string memory tag,
            uint256 lastUpdate
        )
    {
        Validation storage v = _status[requestHash];
        if (!v.exists) revert RequestNotFound();
        return (v.validatorAddress, v.agentId, v.response, v.responseHash, v.requestURI, v.tag, v.lastUpdate);
    }

    function getSummary(uint256 agentId, address[] calldata validatorAddresses, string calldata tag)
        external
        view
        returns (uint64 count, uint8 averageResponse)
    {
        _requireRegistry();
        uint256 total;
        for (uint256 i = 0; i < validatorAddresses.length; i++) {
            bytes32[] memory hashes = _validatorRequests[validatorAddresses[i]];
            for (uint256 j = 0; j < hashes.length; j++) {
                Validation storage v = _status[hashes[j]];
                if (v.agentId != agentId || v.response == 0) continue;
                if (bytes(tag).length > 0 && keccak256(bytes(v.tag)) != keccak256(bytes(tag))) continue;
                count++;
                total += v.response;
            }
        }
        if (count > 0) averageResponse = uint8(total / count);
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return _validatorRequests[validatorAddress];
    }

    function _requireRegistry() private view {
        if (address(identityRegistry) == address(0)) revert NotInitialized();
    }
}
