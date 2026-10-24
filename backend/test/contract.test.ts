import Web3 from "web3";
import { closeChains, deployFreshChain, expectRevert } from "./helpers/chain";

type Chain = Awaited<ReturnType<typeof deployFreshChain>>;

const NAMES = ["Alice", "Bob", "Carol"];
const INFOS = ["Candidate Alice info", "Candidate Bob info", "Candidate Carol info"];
const hash = (id: string) => Web3.utils.keccak256(id);

describe("Election contract", () => {
  let chain: Chain;
  let admin: string;
  let stranger: string;
  let m: Chain["contract"]["methods"];

  afterEach(closeChains);

  beforeEach(async () => {
    chain = await deployFreshChain();
    [admin, stranger] = chain.accounts;
    stranger = chain.accounts[1];
    m = chain.contract.methods;
  });

  const start = (from = admin, names = NAMES, infos = INFOS) =>
    m.startElection("Student council", "Annual election", names, infos).send({ from, gas: 3_000_000 });
  const vote = (id: string, index: number, from = admin) => m.vote(hash(id), index).send({ from, gas: 500_000 });
  const results = async () => {
    const r = await m.getResults().call();
    return Object.fromEntries(r.names.map((n: string, i: number) => [n, Number(r.counts[i])]));
  };

  describe("access control (the original contract had this check commented out)", () => {
    it("lets only admins start an election", async () => {
      await expectRevert(start(stranger), "Only admin");
      await start();
      expect(await m.getStatus().call()).toBe("running");
    });

    it("lets only admins record votes", async () => {
      await start();
      await expectRevert(vote("voter-1", 0, stranger), "Only admin");
    });

    it("lets only admins end and reset", async () => {
      await start();
      await expectRevert(m.endElection().send({ from: stranger }), "Only admin");
      await m.endElection().send({ from: admin });
      await expectRevert(m.resetElection().send({ from: stranger }), "Only admin");
    });

    it("lets only the owner manage admins", async () => {
      await expectRevert(m.addAdmin(stranger).send({ from: stranger }), "Only owner");
      await m.addAdmin(stranger).send({ from: admin });
      expect(await m.admins(stranger).call()).toBe(true);

      // an added admin can run elections but cannot add more admins
      await start(stranger);
      await expectRevert(m.addAdmin(chain.accounts[2]).send({ from: stranger }), "Only owner");

      await m.removeAdmin(stranger).send({ from: admin });
      await expectRevert(vote("voter-1", 0, stranger), "Only admin");
      await expectRevert(m.removeAdmin(admin).send({ from: admin }), "Cannot remove owner");
    });
  });

  describe("starting", () => {
    it("opens voting with the given candidates", async () => {
      await start();
      expect(await m.getElectionName().call()).toBe("Student council");
      expect(await m.getCandidates().call()).toEqual(NAMES);
      expect(await results()).toEqual({ Alice: 0, Bob: 0, Carol: 0 });
    });

    it("validates its input", async () => {
      await expectRevert(start(admin, ["Only one"], ["info"]), "At least 2 candidates");
      await expectRevert(start(admin, ["A", "B"], ["info"]), "Length mismatch");
      await expectRevert(start(admin, ["A", ""], ["x", "y"]), "Empty candidate name");
      await expectRevert(start(admin, ["A", "A"], ["x", "y"]), "Duplicate candidate");
      await expectRevert(
        m.startElection("", "d", NAMES, INFOS).send({ from: admin, gas: 3_000_000 }),
        "Empty election name"
      );
      const many = Array.from({ length: 51 }, (_, i) => `c${i}`);
      await expectRevert(start(admin, many, many), "Too many candidates");
    });

    it("cannot be started twice", async () => {
      await start();
      await expectRevert(start(), "Election already started");
    });
  });

  describe("voting", () => {
    beforeEach(() => start());

    it("counts votes per candidate", async () => {
      await vote("v1", 0);
      await vote("v2", 0);
      await vote("v3", 2);
      expect(await results()).toEqual({ Alice: 2, Bob: 0, Carol: 1 });
      expect(Number(await m.totalVotes().call())).toBe(3);
    });

    it("rejects a second vote from the same voter", async () => {
      await vote("v1", 0);
      await expectRevert(vote("v1", 1), "Already voted");
      expect(await m.hasVoted(hash("v1")).call()).toBe(true);
      expect(await m.hasVoted(hash("v2")).call()).toBe(false);
      expect(await results()).toEqual({ Alice: 1, Bob: 0, Carol: 0 });
    });

    it("rejects an unknown candidate", async () => {
      await expectRevert(vote("v1", 3), "Invalid candidate");
    });

    it("emits an auditable event without any voter identity", async () => {
      const receipt = await vote("v1", 1);
      const ev = receipt.events!.VoteCast.returnValues;
      expect(ev.voterHash).toBe(hash("v1"));
      expect(Number(ev.candidateIndex)).toBe(1);
      expect(JSON.stringify(receipt)).not.toContain("v1");
    });

    it("does not accept votes before the start or after the end", async () => {
      await m.endElection().send({ from: admin });
      await expectRevert(vote("v1", 0), "Election not running");

      const fresh = await deployFreshChain();
      await expectRevert(
        fresh.contract.methods.vote(hash("v1"), 0).send({ from: fresh.accounts[0] }),
        "Election not running"
      );
    });
  });

  describe("ending and resetting", () => {
    it("freezes results when ended", async () => {
      await start();
      await vote("v1", 0);
      await m.endElection().send({ from: admin });
      expect(await m.getStatus().call()).toBe("finished");
      expect(await results()).toEqual({ Alice: 1, Bob: 0, Carol: 0 });
      await expectRevert(m.endElection().send({ from: admin }), "Election not running");
    });

    it("cannot reset a running election", async () => {
      await start();
      await expectRevert(m.resetElection().send({ from: admin }), "Election not finished");
    });

    it("starts a clean round on reset and lets people vote again", async () => {
      await start();
      await vote("v1", 0);
      await m.endElection().send({ from: admin });
      await m.resetElection().send({ from: admin });

      expect(await m.getStatus().call()).toBe("not-started");
      expect(Number(await m.currentRound().call())).toBe(1);
      expect(await m.getCandidates().call()).toEqual([]);

      await start(admin, ["X", "Y"], ["info x", "info y"]);
      await vote("v1", 1); // same voter id is fine in a new round
      expect(await results()).toEqual({ X: 0, Y: 1 });
    });

    it("keeps finished rounds readable as an audit trail", async () => {
      await start();
      await vote("v1", 2);
      await m.endElection().send({ from: admin });
      await m.resetElection().send({ from: admin });

      const old = await m.getResultsOf(0).call();
      expect(old.name).toBe("Student council");
      expect(old.names).toEqual(NAMES);
      expect(old.counts.map(Number)).toEqual([0, 0, 1]);
      await expectRevert(m.getResultsOf(5).call(), "No such round");
    });

    it("costs the same gas to reset no matter how many votes were cast", async () => {
      const gasFor = async (voters: number) => {
        const c = await deployFreshChain();
        const cm = c.contract.methods;
        await cm.startElection("e", "d", ["A", "B"], ["i", "j"]).send({ from: c.accounts[0], gas: 3_000_000 });
        for (let i = 0; i < voters; i++) await cm.vote(hash(`v${i}`), i % 2).send({ from: c.accounts[0], gas: 500_000 });
        await cm.endElection().send({ from: c.accounts[0] });
        return (await cm.resetElection().send({ from: c.accounts[0] })).gasUsed;
      };
      const few = await gasFor(1);
      const many = await gasFor(25);
      expect(many).toBe(few);
    });
  });
});
