// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract SecurityUtils is ReentrancyGuard, Ownable, Pausable {
    // Events
    event EmergencyShutdown(address indexed triggeredBy);
    event EmergencyRecovery(address indexed triggeredBy);
    event BlacklistUpdated(address indexed account, bool isBlacklisted);

    // State variables
    mapping(address => bool) public blacklisted;
    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public constant MIN_OPERATION_INTERVAL = 1 minutes;
    mapping(address => uint256) public lastOperationTime;

    // Modifiers
    modifier notBlacklisted(address _account) {
        require(!blacklisted[_account], "Account is blacklisted");
        _;
    }

    modifier withCooldown() {
        require(
            block.timestamp >= lastOperationTime[msg.sender] + MIN_OPERATION_INTERVAL,
            "Operation too frequent"
        );
        lastOperationTime[msg.sender] = block.timestamp;
        _;
    }

    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address");
        require(_address != address(this), "Cannot be contract address");
        _;
    }

    // Security functions
    function addToBlacklist(address _account) external onlyOwner {
        blacklisted[_account] = true;
        emit BlacklistUpdated(_account, true);
    }

    function removeFromBlacklist(address _account) external onlyOwner {
        blacklisted[_account] = false;
        emit BlacklistUpdated(_account, false);
    }

    function emergencyShutdown() external onlyOwner {
        _pause();
        emit EmergencyShutdown(msg.sender);
    }

    function emergencyRecovery() external onlyOwner {
        _unpause();
        emit EmergencyRecovery(msg.sender);
    }

    // Utility functions
    function isContract(address _addr) public view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    function validateBatchSize(uint256 _size) public pure {
        require(_size <= MAX_BATCH_SIZE, "Batch size too large");
    }

    // Rate limiting
    function checkRateLimit(address _user) public view {
        require(
            block.timestamp >= lastOperationTime[_user] + MIN_OPERATION_INTERVAL,
            "Rate limit exceeded"
        );
    }
} 