/**
 * Test chain: compiles contracts/Election.sol with solc-js and deploys it to an in-process
 * Ganache. No external node, compiler download or running Ganache app is needed.
 */
import fs from "fs";
import path from "path";
import Web3 from "web3";
import ganache from "ganache";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require("solc");

let compiled: { abi: any[]; bytecode: string } | null = null;

export function compileElection() {
  if (compiled) return compiled;
  const source = fs.readFileSync(path.join(__dirname, "../../contracts/Election.sol"), "utf8");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "Election.sol": { content: source } },
        settings: {
          evmVersion: "london",
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      })
    )
  );
  const errors = (output.errors || []).filter((e: any) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e: any) => e.formattedMessage).join("\n"));
  const c = output.contracts["Election.sol"].Election;
  compiled = { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
  return compiled;
}

const openProviders: Array<{ disconnect: () => Promise<void> }> = [];

/** Shuts down every chain created since the last call. Without this Jest never exits. */
export async function closeChains() {
  await Promise.all(openProviders.splice(0).map((p) => p.disconnect()));
}

export async function deployFreshChain() {
  const provider = ganache.provider({
    logging: { quiet: true },
    wallet: { deterministic: true },
    chain: { hardfork: "london", vmErrorsOnRPCResponse: true },
  } as any);
  openProviders.push(provider as any);
  const web3 = new Web3(provider as any);
  const accounts = await web3.eth.getAccounts();
  const { abi, bytecode } = compileElection();
  const contract = await new web3.eth.Contract(abi)
    .deploy({ data: bytecode })
    .send({ from: accounts[0], gas: 6_000_000 });
  return { web3, accounts, abi, address: contract.options.address, contract, provider };
}

/** Asserts that a contract call reverts with the given reason. */
export async function expectRevert(promise: Promise<unknown>, reason: string) {
  try {
    await promise;
  } catch (error: any) {
    expect(String(error.message)).toContain(reason);
    return;
  }
  throw new Error(`Expected a revert containing "${reason}", but the call succeeded`);
}
