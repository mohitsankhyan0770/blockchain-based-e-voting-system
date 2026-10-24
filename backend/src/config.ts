import { createHash } from "crypto";

/**
 * All configuration comes from environment variables (see .env.example).
 * The server refuses to start with missing, weak or previously-published secrets, and
 * the error message lists every problem at once instead of failing one at a time.
 */

// SHA-256 of the JWT secrets that were printed in an earlier version of this repo.
// Only hashes are kept here, so they can be rejected without being republished.
const PUBLISHED_SECRET_HASHES = new Set([
  "3ad4cbc1f7b00091a66373c5fb08b23bb2489c347e505994e403a6e33c7b1498",
  "899325464afabcec921f21a44098fdd8f4df5cc985678855418ab9f2c29bff1f",
]);

export interface Config {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  corsOrigin: string;
  trustProxy: number | false;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
  voterHashSalt: string;
  chain: { rpcUrl: string; contractAddress?: string; fromAddress?: string; artifactPath: string };
  authRateLimit: number; // failed logins / signups per 15 minutes per IP
  voteRateLimit: number; // vote requests per minute per IP
}

export class ConfigError extends Error {
  constructor(public problems: string[]) {
    super(
      "Invalid configuration:\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\nCopy .env.example to .env and fill it in. Generate secrets with: npm run gen:secret"
    );
    this.name = "ConfigError";
  }
}

/** A setup mistake the user can fix (not a bug), so the server prints the message without a stack trace. */
export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];

  const secret = (name: string): string => {
    const value = env[name] ?? "";
    if (!value) problems.push(`${name} is not set`);
    else if (value.length < 32) problems.push(`${name} must be at least 32 characters`);
    else if (PUBLISHED_SECRET_HASHES.has(createHash("sha256").update(value).digest("hex")))
      problems.push(`${name} is a value that was published in this repo's old source. Generate a new one`);
    return value;
  };

  const int = (name: string, fallback: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      problems.push(`${name} must be a non-negative integer`);
      return fallback;
    }
    return n;
  };

  const accessTokenSecret = secret("ACCESS_TOKEN_SECRET");
  const refreshTokenSecret = secret("REFRESH_TOKEN_SECRET");
  const voterHashSalt = secret("VOTER_HASH_SALT");

  if (accessTokenSecret && accessTokenSecret === refreshTokenSecret)
    problems.push("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different");

  const nodeEnv = env.NODE_ENV || "development";
  const trustProxy = int("TRUST_PROXY", 0);

  if (problems.length) throw new ConfigError(problems);

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port: int("PORT", 8000),
    corsOrigin: env.CORS_ORIGIN || "http://localhost:3000",
    trustProxy: trustProxy > 0 ? trustProxy : false,
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenTtl: env.ACCESS_TOKEN_TTL || "10m",
    refreshTokenTtlDays: int("REFRESH_TOKEN_TTL_DAYS", 7),
    voterHashSalt,
    chain: {
      rpcUrl: env.CHAIN_RPC_URL || "http://127.0.0.1:7545",
      contractAddress: env.CONTRACT_ADDRESS || undefined,
      fromAddress: env.CHAIN_FROM_ADDRESS || undefined,
      artifactPath: env.CONTRACT_ARTIFACT || "build/contracts/Election.json",
    },
    authRateLimit: int("AUTH_RATE_LIMIT", 10),
    voteRateLimit: int("VOTE_RATE_LIMIT", 30),
  };
}
