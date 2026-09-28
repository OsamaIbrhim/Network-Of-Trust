// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICertificateValidator {
    function validateIssuance(
        address institution,
        address student,
        string calldata ipfsHash
    ) external view returns (bool allowed, string memory reason);
}