// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title AgentIdentityRegistry
/// @notice A self-deployed reference implementation of the ERC-8004 Identity Registry
///         (https://eips.ethereum.org/EIPS/eip-8004) for QDay Aevum testnet. QDay has not
///         published canonical registry addresses yet, so this deployment is intentionally
///         local to the app. tokenId == agentId.
contract AgentIdentityRegistry is ERC721URIStorage, Ownable, EIP712 {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    bytes32 private constant WALLET_TYPEHASH = keccak256("AgentWallet(address newWallet,uint256 deadline)");

    uint256 private _nextId = 1;
    mapping(uint256 agentId => mapping(bytes32 key => bytes value)) private _metadata;
    mapping(uint256 agentId => address wallet) private _agentWallet;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );
    event AgentWalletSet(uint256 indexed agentId, address indexed agentWallet);
    event AgentWalletUnset(uint256 indexed agentId);

    error NotAuthorized();
    error InvalidSignatureOrDeadline();
    error ReservedMetadataKey();

    constructor() ERC721("Agent Identity", "AGENT") Ownable(msg.sender) EIP712("AgentIdentityRegistry", "1") {}

    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId) {
        return _register(agentURI, metadata);
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        MetadataEntry[] memory empty;
        return _register(agentURI, empty);
    }

    function register() external returns (uint256 agentId) {
        MetadataEntry[] memory empty;
        return _register("", empty);
    }

    function _register(string memory agentURI, MetadataEntry[] memory metadata) private returns (uint256 agentId) {
        agentId = _nextId++;
        _safeMint(msg.sender, agentId);
        if (bytes(agentURI).length > 0) _setTokenURI(agentId, agentURI);
        for (uint256 i = 0; i < metadata.length; i++) {
            _setMetadata(agentId, metadata[i].metadataKey, metadata[i].metadataValue);
        }
        emit Registered(agentId, agentURI, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        _requireAuthorized(agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        _requireAuthorized(agentId);
        if (keccak256(bytes(metadataKey)) == keccak256("agentWallet")) revert ReservedMetadataKey();
        _setMetadata(agentId, metadataKey, metadataValue);
    }

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][keccak256(bytes(metadataKey))];
    }

    /// @notice Set the agent wallet. The new wallet must prove control with an EIP-712
    ///         signature (EOA) or ERC-1271 isValidSignature (smart account).
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external {
        _requireAuthorized(agentId);
        if (newWallet == address(0) || deadline < block.timestamp || signature.length == 0) {
            revert InvalidSignatureOrDeadline();
        }
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(WALLET_TYPEHASH, newWallet, deadline)));
        bool valid;
        if (newWallet.code.length > 0) {
            valid = IERC1271(newWallet).isValidSignature(digest, signature) == IERC1271.isValidSignature.selector;
        } else {
            valid = ECDSA.recover(digest, signature) == newWallet;
        }
        if (!valid) revert InvalidSignatureOrDeadline();
        _agentWallet[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    function getAgentWallet(uint256 agentId) public view returns (address) {
        address stored = _agentWallet[agentId];
        return stored == address(0) ? ownerOf(agentId) : stored;
    }

    /// @notice EIP-712 digest the new wallet must sign for `setAgentWallet`.
    function walletDigest(address newWallet, uint256 deadline) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(WALLET_TYPEHASH, newWallet, deadline)));
    }

    function unsetAgentWallet(uint256 agentId) external {
        _requireAuthorized(agentId);
        delete _agentWallet[agentId];
        emit AgentWalletUnset(agentId);
    }

    function agentRegistry() external view returns (string memory) {
        return string.concat("eip155:", _toString(block.chainid), ":", _toString(address(this)));
    }

    function _setMetadata(uint256 agentId, string memory key, bytes memory value) private {
        _metadata[agentId][keccak256(bytes(key))] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    function _requireAuthorized(uint256 agentId) private view {
        address tokenOwner = ownerOf(agentId);
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender) && getApproved(agentId) != msg.sender) {
            revert NotAuthorized();
        }
    }

    /// @dev Clear the bound wallet on transfer, as required by ERC-8004.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address previous = super._update(to, tokenId, auth);
        if (previous != address(0) && to != previous) {
            delete _agentWallet[tokenId];
            emit AgentWalletUnset(tokenId);
        }
        return previous;
    }

    function _toString(address a) private pure returns (string memory) {
        return _toString(uint256(uint160(a)));
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
