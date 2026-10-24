import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import "reflect-metadata";
import { Connection, createConnection } from "typeorm";
import Web3 from "web3";
import { Web3ElectionChain } from "../src/chain";
import { loadConfig } from "../src/config";
import { User } from "../src/entity/User";
import { createApp } from "../src/server";
import { closeChains, deployFreshChain } from "./helpers/chain";

const SECRETS = {
  ACCESS_TOKEN_SECRET: "a".repeat(40),
  REFRESH_TOKEN_SECRET: "b".repeat(40),
  VOTER_HASH_SALT: "c".repeat(40),
};
const config = loadConfig({ ...SECRETS, AUTH_RATE_LIMIT: "1000", VOTE_RATE_LIMIT: "1000" } as any);
const PASSWORD = "correct horse battery";
const ELECTION = {
  name: "Student council",
  description: "Annual council election",
  candidates: [
    { name: "Alice", info: "Candidate Alice information" },
    { name: "Bob", info: "Candidate Bob information" },
  ],
};

let connection: Connection;
let chainEnv: Awaited<ReturnType<typeof deployFreshChain>>;
let app: ReturnType<typeof createApp>;

async function makeUser(over: Partial<User> & { email: string }) {
  const user = new User();
  Object.assign(user, {
    name: over.email.split("@")[0],
    citizenshipNumber: `cn-${over.email}`,
    admin: false,
    verified: true,
    ...over,
  });
  user.password = await bcrypt.hash(PASSWORD, 4);
  return user.save();
}

async function loginAs(email: string, a = app) {
  const res = await request(a).post("/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return {
    token: res.body.accessToken as string,
    cookie: (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("refreshToken="))!,
    body: res.body,
  };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** supertest rejects `.send(undefined)`, so only attach a body when there is one. */
const call = (method: string, url: string, body?: object, token?: string) => {
  let req = (request(app) as any)[method](url);
  if (token) req = req.set(bearer(token));
  return body === undefined ? req : req.send(body);
};

beforeAll(async () => {
  connection = await createConnection({ type: "sqljs", entities: [User], synchronize: true, dropSchema: true });
});
afterAll(async () => {
  await connection.close();
});
afterEach(closeChains);
beforeEach(async () => {
  await User.clear();
  chainEnv = await deployFreshChain();
  const chain = new Web3ElectionChain(chainEnv.web3, chainEnv.abi, chainEnv.address, config.voterHashSalt);
  app = createApp(config, chain);
});

describe("accounts", () => {
  it("signs up an unverified, non-admin user and never returns the password hash", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ name: "Sam Voter", email: "Sam@Example.com", password: PASSWORD, citizenshipNumber: "12345", admin: true, verified: true });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "sam@example.com", admin: false, verified: false });
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  it("validates signups", async () => {
    const base = { name: "Sam Voter", email: "sam@example.com", password: PASSWORD, citizenshipNumber: "12345" };
    expect((await request(app).post("/auth/signup").send({ ...base, password: "short" })).status).toBe(400);
    expect((await request(app).post("/auth/signup").send({ ...base, email: "nope" })).status).toBe(400);
    expect((await request(app).post("/auth/signup").send({ ...base, citizenshipNumber: undefined })).status).toBe(400);
    expect((await request(app).post("/auth/signup").send(base)).status).toBe(201);
    expect((await request(app).post("/auth/signup").send(base)).status).toBe(409);
    expect((await request(app).post("/auth/signup").send({ ...base, email: "other@example.com" })).status).toBe(409);
  });

  it("logs in, sets a locked-down refresh cookie, and hides the password hash", async () => {
    await makeUser({ email: "v@example.com" });
    const { cookie, body } = await loginAs("v@example.com");
    expect(body.user.email).toBe("v@example.com");
    expect(JSON.stringify(body)).not.toMatch(/password|\$2[aby]\$/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/auth/);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    await makeUser({ email: "v@example.com" });
    const wrong = await request(app).post("/auth/login").send({ email: "v@example.com", password: "wrong-password" });
    const unknown = await request(app).post("/auth/login").send({ email: "nobody@example.com", password: "wrong-password" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.text).toBe(wrong.text);
  });

  it("blocks unverified accounts from logging in", async () => {
    await makeUser({ email: "new@example.com", verified: false });
    const res = await request(app).post("/auth/login").send({ email: "new@example.com", password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it("refreshes an access token from the cookie, and rejects missing or wrong tokens", async () => {
    const user = await makeUser({ email: "v@example.com" });
    const { cookie, token } = await loginAs("v@example.com");

    const ok = await request(app).post("/auth/check").set("Cookie", cookie);
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();

    expect((await request(app).post("/auth/check")).status).toBe(401);
    // an access token must not be accepted as a refresh token (different secrets)
    expect((await request(app).post("/auth/check").set("Cookie", `refreshToken=${token}`)).status).toBe(401);

    await user.remove(); // a deleted user cannot refresh
    expect((await request(app).post("/auth/check").set("Cookie", cookie)).status).toBe(401);
  });

  it("logs out by clearing the cookie", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
    expect((res.headers["set-cookie"] as unknown as string[])[0]).toMatch(/refreshToken=;/);
  });
});

describe("authorization (every one of these routes was open to the internet before)", () => {
  // every row has 3 values: jest.each would otherwise hand its `done` callback to the missing one
  const adminRoutes: [string, string, object | undefined][] = [
    ["post", "/polls/start", ELECTION],
    ["post", "/polls/end", undefined],
    ["post", "/polls/reset", undefined],
    ["get", "/users/all", undefined],
    ["post", "/users/verify", { userId: 1 }],
    ["delete", "/users/delete/1", undefined],
  ];
  const userRoutes: [string, string, object | undefined][] = [
    ["post", "/polls/vote", { candidate: "Alice" }],
    ["post", "/polls/check-voteability", {}],
  ];

  it.each([...adminRoutes, ...userRoutes])("rejects anonymous %s %s with 401", async (method, url, body) => {
    const res = await call(method, url, body);
    expect(res.status).toBe(401);
  });

  it.each(adminRoutes)("rejects a normal voter on %s %s with 403", async (method, url, body) => {
    await makeUser({ email: "voter@example.com" });
    const { token } = await loginAs("voter@example.com");
    const res = await call(method, url, body, token);
    expect(res.status).toBe(403);
  });

  it("rejects forged, expired and unsigned tokens", async () => {
    const user = await makeUser({ email: "admin@example.com", admin: true });
    const forged = jwt.sign({ sub: String(user.id) }, "x".repeat(40));
    const expired = jwt.sign({ sub: String(user.id) }, config.accessTokenSecret, { expiresIn: -10 });
    const unsigned = jwt.sign({ sub: String(user.id) }, "", { algorithm: "none" } as jwt.SignOptions);
    for (const token of [forged, expired, unsigned, "garbage"]) {
      expect((await request(app).get("/users/all").set(bearer(token))).status).toBe(401);
    }
  });

  it("stops honouring a token the moment the user is deleted or demoted", async () => {
    const admin = await makeUser({ email: "admin@example.com", admin: true });
    const { token } = await loginAs("admin@example.com");
    expect((await request(app).get("/users/all").set(bearer(token))).status).toBe(200);

    admin.admin = false;
    await admin.save();
    expect((await request(app).get("/users/all").set(bearer(token))).status).toBe(403);

    await admin.remove();
    expect((await request(app).get("/users/all").set(bearer(token))).status).toBe(401);
  });

  it("lets an admin verify and delete users, but never admins or themselves", async () => {
    const admin = await makeUser({ email: "admin@example.com", admin: true });
    const other = await makeUser({ email: "other@example.com", admin: true });
    const pending = await makeUser({ email: "pending@example.com", verified: false });
    const { token } = await loginAs("admin@example.com");

    const list = await request(app).get("/users/all").set(bearer(token));
    expect(list.body.users.map((u: any) => u.email)).toEqual(["pending@example.com"]);
    expect(JSON.stringify(list.body)).not.toMatch(/password/);

    const verified = await request(app).post("/users/verify").set(bearer(token)).send({ userId: pending.id });
    expect(verified.status).toBe(200);
    expect(verified.body.user.verified).toBe(true);
    expect((await request(app).post("/users/verify").set(bearer(token)).send({ userId: 9999 })).status).toBe(404);

    expect((await request(app).delete(`/users/delete/${admin.id}`).set(bearer(token))).status).toBe(400);
    expect((await request(app).delete(`/users/delete/${other.id}`).set(bearer(token))).status).toBe(400);
    expect((await request(app).delete(`/users/delete/${pending.id}`).set(bearer(token))).status).toBe(200);
    expect((await request(app).delete("/users/delete/abc").set(bearer(token))).status).toBe(400);
  });
});

describe("running an election end to end", () => {
  let admin: string;
  let alice: User;
  let aliceToken: string;
  let bobToken: string;

  beforeEach(async () => {
    await makeUser({ email: "admin@example.com", admin: true });
    alice = await makeUser({ email: "alice.voter@example.com", name: "Alice Voter" });
    await makeUser({ email: "bob.voter@example.com", name: "Bob Voter" });
    admin = (await loginAs("admin@example.com")).token;
    aliceToken = (await loginAs("alice.voter@example.com")).token;
    bobToken = (await loginAs("bob.voter@example.com")).token;
  });

  const start = () => request(app).post("/polls/start").set(bearer(admin)).send(ELECTION);
  const vote = (token: string, body: object = { candidate: "Alice" }) =>
    request(app).post("/polls/vote").set(bearer(token)).send(body);

  it("validates the election an admin tries to start", async () => {
    const post = (b: object) => request(app).post("/polls/start").set(bearer(admin)).send(b);
    expect((await post({ ...ELECTION, candidates: [ELECTION.candidates[0]] })).status).toBe(400);
    expect((await post({ ...ELECTION, candidates: [ELECTION.candidates[0], { ...ELECTION.candidates[0], name: "ALICE" }] })).status).toBe(400);
    expect((await post({ ...ELECTION, candidates: [ELECTION.candidates[0], { name: "Bob", info: "short" }] })).status).toBe(400);
    expect((await post({ ...ELECTION, name: "x" })).status).toBe(400);
  });

  it("runs start -> vote -> end -> reset and reports results to the public", async () => {
    expect((await request(app).get("/polls/status")).body).toEqual({ status: "not-started" });
    expect((await vote(aliceToken)).status).toBe(400); // nothing to vote on yet

    expect((await start()).status).toBe(201);
    expect((await start()).status).toBe(400); // cannot start twice
    expect((await request(app).get("/polls/status")).body).toEqual({ status: "running" });

    expect((await request(app).post("/polls/check-voteability").set(bearer(aliceToken))).text).toBe("not-voted");
    expect((await vote(aliceToken)).status).toBe(200);
    expect((await request(app).post("/polls/check-voteability").set(bearer(aliceToken))).text).toBe("already-voted");
    expect((await vote(bobToken, { candidate: "Bob" })).status).toBe(200);

    const live = await request(app).get("/polls/"); // no login needed to watch
    expect(live.body).toEqual({ name: ELECTION.name, description: ELECTION.description, votes: { Alice: 1, Bob: 1 } });

    expect((await request(app).post("/polls/reset").set(bearer(admin))).status).toBe(400); // not finished
    const ended = await request(app).post("/polls/end").set(bearer(admin));
    expect(ended.body.votes).toEqual({ Alice: 1, Bob: 1 });
    expect((await request(app).get("/polls/status")).body).toEqual({ status: "finished" });
    expect((await vote(aliceToken)).status).toBe(400);

    expect((await request(app).post("/polls/reset").set(bearer(admin))).status).toBe(200);
    expect((await request(app).get("/polls/status")).body).toEqual({ status: "not-started" });
    expect((await start()).status).toBe(201);
    expect((await vote(aliceToken)).status).toBe(200); // a new election, so they may vote again
  });

  it("rejects a second vote and unknown candidates", async () => {
    await start();
    expect((await vote(aliceToken)).status).toBe(200);
    expect((await vote(aliceToken, { candidate: "Bob" })).status).toBe(409);
    expect((await vote(bobToken, { candidate: "Mallory" })).status).toBe(400);
    expect((await vote(bobToken, {})).status).toBe(400);
    expect((await request(app).get("/polls/votes")).body.votes).toEqual({ Alice: 1, Bob: 0 });
  });

  it("ignores any identity sent in the body: you can only vote as yourself", async () => {
    await start();
    // Alice claims to be Bob. Before, the server believed the body.
    const spoof = await vote(aliceToken, { candidate: "Alice", id: "999", name: "Bob Voter" });
    expect(spoof.status).toBe(200);
    // Alice used her own one vote; she cannot vote again by changing the claimed id
    expect((await vote(aliceToken, { candidate: "Bob", id: "1234" })).status).toBe(409);
    // and Bob is unaffected
    expect((await vote(bobToken, { candidate: "Bob" })).status).toBe(200);
  });

  it("does not let two simultaneous requests from one voter both count", async () => {
    await start();
    const results = await Promise.all([vote(aliceToken), vote(aliceToken), vote(aliceToken)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await request(app).get("/polls/votes")).body.votes).toEqual({ Alice: 1, Bob: 0 });
  });

  it("keeps voter identities off the chain", async () => {
    await start();
    await vote(aliceToken);

    const contract = new chainEnv.web3.eth.Contract(chainEnv.abi as any, chainEnv.address);
    const events = await contract.getPastEvents("VoteCast", { fromBlock: 0 });
    expect(events).toHaveLength(1);

    const everything = JSON.stringify(events);
    expect(everything).not.toContain("Alice Voter");
    expect(everything).not.toContain("alice.voter@example.com");

    // The hash is salted: it is NOT what you get by hashing the guessable user id.
    const unsalted = [
      Web3.utils.soliditySha3({ type: "uint256", value: "0" }, { type: "uint256", value: String(alice.id) }, { type: "string", value: "" }),
      Web3.utils.soliditySha3({ type: "uint256", value: String(alice.id) }),
      Web3.utils.keccak256(String(alice.id)),
    ];
    expect(unsalted).not.toContain(events[0].returnValues.voterHash);
  });
});

describe("hardening", () => {
  it("throttles repeated failed logins", async () => {
    const strict = loadConfig({ ...SECRETS, AUTH_RATE_LIMIT: "3" } as any);
    const chain = new Web3ElectionChain(chainEnv.web3, chainEnv.abi, chainEnv.address, strict.voterHashSalt);
    const strictApp = createApp(strict, chain);
    await makeUser({ email: "v@example.com" });

    const attempt = () => request(strictApp).post("/auth/login").send({ email: "v@example.com", password: "wrong-password" });
    expect([(await attempt()).status, (await attempt()).status, (await attempt()).status]).toEqual([401, 401, 401]);
    expect((await attempt()).status).toBe(429);
    // and a locked-out attacker does not stop the real user's successful logins from being counted against them
    expect((await request(strictApp).post("/auth/login").send({ email: "v@example.com", password: PASSWORD })).status).toBe(429);
  });

  it("answers 503 (not a crash) when the blockchain node is down", async () => {
    const down = new Web3ElectionChain(new Web3("http://127.0.0.1:9"), chainEnv.abi, chainEnv.address, "s".repeat(40));
    const downApp = createApp(config, down);
    const res = await request(downApp).get("/polls/status");
    expect(res.status).toBe(503);
    expect(res.text).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/); // no internals leaked
    expect((await request(downApp).get("/health")).status).toBe(200); // the API itself stays up
  });

  it("returns clean errors for bad input and unknown routes", async () => {
    const bad = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(bad.status).toBe(400);
    expect(bad.text).toBe("invalid JSON");
    expect((await request(app).get("/nope")).status).toBe(404);
    // a long password is a validation error (400); an oversized request body is refused outright (413)
    expect((await request(app).post("/auth/login").send({ email: "a@b.co", password: "x".repeat(5000) })).status).toBe(400);
    expect((await request(app).post("/auth/login").send({ email: "a@b.co", password: "x".repeat(30000) })).status).toBe(413);
  });

  it("sends standard security headers and no framework banner", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("configuration", () => {
  it("refuses to start with missing, short, identical or previously-published secrets", () => {
    expect(() => loadConfig({} as any)).toThrow(/ACCESS_TOKEN_SECRET is not set/);
    expect(() => loadConfig({ ...SECRETS, ACCESS_TOKEN_SECRET: "short" } as any)).toThrow(/at least 32/);
    expect(() => loadConfig({ ...SECRETS, REFRESH_TOKEN_SECRET: SECRETS.ACCESS_TOKEN_SECRET } as any)).toThrow(/must be different/);
    const published = "976a66a5bd23b2050019f380c4decbbefdf8ff91cf502c68a3fe1ced91d7448cc54ce6c847657d53294e40889cef5bd996ec5b0fefc1f56270e06990657eeb6e";
    expect(() => loadConfig({ ...SECRETS, ACCESS_TOKEN_SECRET: published } as any)).toThrow(/published/);
  });

  it("reports every problem at once", () => {
    try {
      loadConfig({} as any);
      throw new Error("should have thrown");
    } catch (e: any) {
      expect(e.problems.length).toBeGreaterThanOrEqual(3);
    }
  });
});
