// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Alcancia} from "../src/Alcancia.sol";
import {AlcanciaFactory} from "../src/AlcanciaFactory.sol";

/// Usage (example):
///   AGENT_ADDRESS=0x... forge script script/Deploy.s.sol --rpc-url celo --broadcast --account <keystore>
contract Deploy is Script {
    function run() external returns (Alcancia implementation, AlcanciaFactory factory) {
        address agent = vm.envAddress("AGENT_ADDRESS");

        vm.startBroadcast();
        implementation = new Alcancia();
        factory = new AlcanciaFactory(address(implementation), agent);
        vm.stopBroadcast();

        console.log("Alcancia implementation:", address(implementation));
        console.log("AlcanciaFactory:", address(factory));
        console.log("Agent:", agent);
        console.log("Admin:", factory.admin());
    }
}
