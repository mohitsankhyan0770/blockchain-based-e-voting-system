import fs from "fs";
import path from "path";
import Web3 from "web3";
import { Config, SetupError } from "./config";

export type ElectionStatus = "not-started" | "running" | "finished";
export type CandidateResult = { name: string; votes: number };
export type ChainErrorCode =
  | "ALREADY_VOTED"
  | "NOT_RUNNING"
  | "INVALID_CANDIDATE"
  | "BAD_STATE"
  | "UNAVAILABLE"
  | "UNKNOWN";

export class ChainError extends Error {
  constructor(public code: ChainErrorCode, message: string) {
    super(message);
    this.name = "ChainError";
  }
}

/** Everything the API needs from the blockchain. Tests and the server use the same interface. */
export interface ElectionChain {
  status(): Promise<ElectionStatus>;
  details(): Promise<{ name: string; description: string }>;
  results(): Promise<CandidateResult[]>;
  start(input: {
    name: string;
    description: string;
    candidates: { name: string; info: string }[];
  }): Promise<void>;
  hasVoted(userId: number): Promise<boolean>;
  vote(userId: number, candidateName: string): Promise<void>;
  end(): Promise<CandidateResult[]>;
  reset(): Promise<void>;
}

const REVERT_REASONS: [string, ChainErrorCode][] = [
  ["Already voted", "ALREADY_VOTED"],
  ["Election not running", "NOT_RUNNING"],
  ["Invalid candidate", "INVALID_CANDIDATE"],
  ["Election already started", "BAD_STATE"],
  ["Election not finished", "BAD_STATE"],
  ["Only admin", "BAD_STATE"],
];

function translate(error: unknown): ChainError {
  if (error instanceof ChainError) return error;
  const message = String((error as Error)?.message ?? error);
  for (const [reason, code] of REVERT_REASONS) if (message.includes(reason)) return new ChainError(code, reason);
  if (/ECONNREFUSED|ENOTFOUND|connection not open|Invalid JSON RPC|CONNECTION ERROR|timeout/i.test(message))
    return new ChainError("UNAVAILABLE", "blockchain node not reachable");
  return new ChainError("UNKNOWN", message);
}

export class Web3ElectionChain implements ElectionChain {
  private contract: any;
  private fromAddress?: string;

  constructor(
    private web3: Web3,
    abi: any[],
    address: string,
    private voterSalt: string,
    fromAddress?: string
  ) {
    this.contract = new web3.eth.Contract(abi as any, address);
    this.fromAddress = fromAddress;
  }

  private async from(): Promise<string> {
    if (!this.fromAddress) {
      const accounts = await this.web3.eth.getAccounts();
      if (!accounts.length) throw new ChainError("UNAVAILABLE", "no unlocked account on the node");
      this.fromAddress = accounts[0];
    }
    return this.fromAddress;
  }

  /** eth_call first so a revert surfaces its reason, then estimate gas and send. */
  private async send(method: any): Promise<void> {
    try {
      const from = await this.from();
      await method.call({ from });
      const gas = await method.estimateGas({ from });
      await method.send({ from, gas: Math.ceil(Number(gas) * 1.3) });
    } catch (error) {
      throw translate(error);
    }
  }

  private async read<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw translate(error);
    }
  }

  /**
   * What goes on-chain instead of a user id: keccak256(round, userId, secret salt).
   * The salt matters. User ids are small integers, so without it anyone could hash 1..N,
   * match the results against public VoteCast events and learn how each person voted.
   */
  private async voterHash(userId: number): Promise<string> {
    const round = await this.contract.methods.currentRound().call();
    const hash = Web3.utils.soliditySha3(
      { type: "uint256", value: round },
      { type: "uint256", value: String(userId) },
      { type: "string", value: this.voterSalt }
    );
    if (!hash) throw new ChainError("UNKNOWN", "could not hash voter id");
    return hash;
  }

  status = () => this.read(async () => (await this.contract.methods.getStatus().call()) as ElectionStatus);

  details = () =>
    this.read(async () => ({
      name: (await this.contract.methods.getElectionName().call()) as string,
      description: (await this.contract.methods.getElectionDescription().call()) as string,
    }));

  results = () =>
    this.read(async () => {
      const r = await this.contract.methods.getResults().call();
      return (r.names as string[]).map((name, i) => ({ name, votes: Number(r.counts[i]) }));
    });

  start = (input: Parameters<ElectionChain["start"]>[0]) =>
    this.send(
      this.contract.methods.startElection(
        input.name,
        input.description,
        input.candidates.map((c) => c.name),
        input.candidates.map((c) => c.info)
      )
    );

  hasVoted = (userId: number) =>
    this.read(async () => Boolean(await this.contract.methods.hasVoted(await this.voterHash(userId)).call()));

  vote = async (userId: number, candidateName: string) => {
    const names: string[] = await this.read(() => this.contract.methods.getCandidates().call());
    const index = names.indexOf(candidateName);
    if (index === -1) throw new ChainError("INVALID_CANDIDATE", "no such candidate");
    const hash = await this.read(() => this.voterHash(userId));
    await this.send(this.contract.methods.vote(hash, index));
  };

  end = async () => {
    await this.send(this.contract.methods.endElection());
    return this.results();
  };

  reset = () => this.send(this.contract.methods.resetElection());
}

/** Reads the ABI and deployed address from the Truffle build output (`truffle migrate`). */
export function loadTruffleArtifact(artifactPath: string, contractAddress?: string) {
  const file = path.resolve(artifactPath);
  if (!fs.existsSync(file))
    throw new SetupError(`Contract artifact not found at ${file}. Run "truffle migrate --reset" in the backend folder first.`);
  const artifact = JSON.parse(fs.readFileSync(file, "utf8"));

  let address = contractAddress;
  if (!address) {
    const networks = Object.values<any>(artifact.networks ?? {});
    networks.sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
    address = networks[0]?.address;
  }
  if (!address)
    throw new SetupError('The contract is not deployed. Run "truffle migrate --reset", or set CONTRACT_ADDRESS in .env.');
  return { abi: artifact.abi as any[], address };
}

export function createChainFromConfig(config: Config): ElectionChain {
  const { abi, address } = loadTruffleArtifact(config.chain.artifactPath, config.chain.contractAddress);
  const web3 = new Web3(new Web3.providers.HttpProvider(config.chain.rpcUrl));
  return new Web3ElectionChain(web3, abi, address, config.voterHashSalt, config.chain.fromAddress);
}
