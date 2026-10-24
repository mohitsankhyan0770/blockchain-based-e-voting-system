/**
 * Compiles contracts/Election.sol, deploys it to the blockchain at CHAIN_RPC_URL, and writes
 * build/contracts/Election.json (the same shape Truffle writes) so the API can find the contract.
 *
 *   npm run deploy
 *
 * This replaces `truffle migrate --reset`. Run it again any time to deploy a fresh contract.
 * It needs a running blockchain first (see the README: `npx ganache ...`).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import Web3 from "web3";
import { SetupError } from "../config";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require("solc");

const CONTRACT_FILE = path.join(__dirname, "../../contracts/Election.sol");

export function compileElection(file = CONTRACT_FILE): { abi: any[]; bytecode: string } {
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "Election.sol": { content: fs.readFileSync(file, "utf8") } },
        settings: {
          // "london" avoids opcodes that older chains do not know
          evmVersion: "london",
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      })
    )
  );
  const errors = (output.errors || []).filter((e: any) => e.severity === "error");
  if (errors.length) throw new SetupError(`The contract does not compile:\n${errors.map((e: any) => e.formattedMessage).join("\n")}`);

  const compiled = output.contracts["Election.sol"].Election;
  return { abi: compiled.abi, bytecode: "0x" + compiled.evm.bytecode.object };
}

async function main() {
  const rpcUrl = process.env.CHAIN_RPC_URL || "http://127.0.0.1:7545";
  const artifactPath = path.resolve(process.env.CONTRACT_ARTIFACT || "build/contracts/Election.json");

  console.log("Compiling contract...");
  const { abi, bytecode } = compileElection();

  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  let accounts: string[];
  let networkId: number;
  try {
    accounts = await web3.eth.getAccounts();
    networkId = await web3.eth.net.getId();
  } catch {
    throw new SetupError(
      `Cannot reach the blockchain at ${rpcUrl}.\nStart it first in another terminal:\n` +
        '  npx ganache -p 7545 -d --chain.hardfork london --database.dbPath "$env:USERPROFILE\\ganache-bbvs"'
    );
  }

  const from = process.env.CHAIN_FROM_ADDRESS || accounts[0];
  if (!from) throw new SetupError("The blockchain has no unlocked account to deploy from.");

  console.log(`Deploying from ${from} to ${rpcUrl} ...`);
  const deployment = new web3.eth.Contract(abi as any).deploy({ data: bytecode });
  const gas = await deployment.estimateGas({ from });
  const contract = await deployment.send({ from, gas: Math.ceil(Number(gas) * 1.3) });
  const address = contract.options.address;

  // sanity check: a fresh election must report "not-started"
  const status = await contract.methods.getStatus().call();
  if (status !== "not-started") throw new Error(`Unexpected status after deploy: ${status}`);

  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        contractName: "Election",
        abi,
        bytecode,
        networks: { [networkId]: { address, updatedAt: Date.now() } },
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`\nDeployed Election at ${address}`);
  console.log(`Wrote ${artifactPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof SetupError ? error.message : error);
    process.exit(1);
  });
}