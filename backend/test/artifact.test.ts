import fs from "fs";
import os from "os";
import path from "path";
import { loadTruffleArtifact } from "../src/chain";
import { compileElection } from "./helpers/chain";

describe("loadTruffleArtifact (the link between `truffle migrate` and the API)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-"));
  const write = (networks: object) => {
    const file = path.join(dir, `Election-${Math.random()}.json`);
    fs.writeFileSync(file, JSON.stringify({ abi: compileElection().abi, networks }));
    return file;
  };
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("reads the ABI and the most recently deployed address", () => {
    const file = write({
      "1111": { address: "0xOLD", updatedAt: 100 },
      "5777": { address: "0xNEW", updatedAt: 200 },
    });
    const { abi, address } = loadTruffleArtifact(file);
    expect(address).toBe("0xNEW");
    expect(abi.some((entry: any) => entry.name === "startElection")).toBe(true);
  });

  it("lets CONTRACT_ADDRESS override the artifact", () => {
    expect(loadTruffleArtifact(write({}), "0xCONFIGURED").address).toBe("0xCONFIGURED");
  });

  it("explains what to do when the contract was never built or deployed", () => {
    expect(() => loadTruffleArtifact(path.join(dir, "missing.json"))).toThrow(/truffle migrate/);
    expect(() => loadTruffleArtifact(write({}))).toThrow(/not deployed/);
  });
});
