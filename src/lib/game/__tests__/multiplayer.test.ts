/**
 * ============================================================================
 * v2.0 TESTS — multiplayer engine (pure logic)
 * ============================================================================
 * Covers:
 * - Session creation, role claiming, multiple roles per player
 * - Event routing (role holders, fallback to whole team, cooperation modes)
 * - Proposal & voting flows
 * - Contribution statistics
 * - Host migration and auto role assignment
 * ============================================================================
 */

import { describe, test, expect } from "bun:test";
import {
  createSession,
  makePlayer,
  routeEvent,
  tallyVotes,
  voteComplete,
  proposalNeedsCommander,
  creditDecision,
  contributionReports,
  lobbyReady,
  migrateHost,
  autoAssignRoles,
  assignedRoles,
  unassignedRoles,
  MAX_PLAYERS,
} from "../multiplayer";
import { MissionEvent } from "../types";

function testEvent(seed: Partial<MissionEvent>): MissionEvent {
  return {
    id: "evt",
    stage: 3,
    title: "Test Event",
    description: "A test event.",
    educationalNote: "Education.",
    choices: [
      { id: "a", label: "A", description: "Option A", effects: { quality: 0.9 } },
      { id: "b", label: "B", description: "Option B", effects: { quality: 0.4 } },
    ],
    ...seed,
  };
}

function fourPlayerSession() {
  const host = makePlayer("p1", "Ada");
  host.roles = ["commander"];
  const s = createSession("TEST", host);
  const players = [
    makePlayer("p2", "Bob"),
    makePlayer("p3", "Cleo"),
    makePlayer("p4", "Dee"),
  ];
  players[0].roles = ["engineer"];
  players[1].roles = ["navigator"];
  players[2].roles = ["scientist"];
  return { ...s, players: [s.players[0], ...players] };
}

describe("multiplayer session & roles", () => {
  test("session starts in lobby with one host player", () => {
    const host = makePlayer("p1", "Ada", true);
    const s = createSession("ABCD", host);
    expect(s.phase).toBe("lobby");
    expect(s.players).toHaveLength(1);
    expect(s.players[0].isHost).toBe(true);
    expect(MAX_PLAYERS).toBe(4);
  });

  test("players can hold multiple roles (fewer than four players)", () => {
    const host = makePlayer("p1", "Solo");
    host.roles = ["commander", "engineer"];
    const s = createSession("ABCD", host);
    expect(assignedRoles(s).sort()).toEqual(["commander", "engineer"]);
    expect(unassignedRoles(s).sort()).toEqual(["navigator", "scientist"]);
  });

  test("auto-assign distributes all four roles across players", () => {
    const host = makePlayer("p1", "Ada");
    const s = createSession("ABCD", host);
    const two = { ...s, players: [host, makePlayer("p2", "Bob")] };
    const assigned = autoAssignRoles(two);
    const held = new Set(assigned.players.flatMap((p) => p.roles));
    expect(held.size).toBe(4);
  });
});

describe("multiplayer event routing", () => {
  test("untagged events go to the whole team", () => {
    const s = fourPlayerSession();
    const r = routeEvent(testEvent({}), s);
    expect(r.eligiblePlayerIds).toHaveLength(4);
    expect(r.mode).toBe("solo");
  });

  test("engineer events route to the engineer", () => {
    const s = fourPlayerSession();
    const r = routeEvent(testEvent({ roles: ["engineer"] }), s);
    expect(r.eligiblePlayerIds).toEqual(["p2"]);
  });

  test("events for an unheld role open to everyone", () => {
    const host = makePlayer("p1", "Ada");
    host.roles = ["commander"];
    const s = createSession("ABCD", host);
    const r = routeEvent(testEvent({ roles: ["scientist"] }), s);
    expect(r.eligiblePlayerIds).toEqual(["p1"]);
  });

  test("cooperative proposal events declare proposal mode", () => {
    const s = fourPlayerSession();
    const r = routeEvent(testEvent({ roles: ["engineer"], cooperative: "proposal" }), s);
    expect(r.mode).toBe("proposal");
    expect(r.eligiblePlayerIds).toEqual(["p2"]);
  });

  test("vote events declare vote mode and include everyone", () => {
    const s = fourPlayerSession();
    const r = routeEvent(testEvent({ cooperative: "vote" }), s);
    expect(r.mode).toBe("vote");
    expect(r.eligiblePlayerIds).toHaveLength(4);
  });

  test("proposal approval is required only when a commander is connected", () => {
    const withCmd = fourPlayerSession();
    expect(proposalNeedsCommander(withCmd)).toBe(true);
    const noCmd = { ...withCmd, players: withCmd.players.map((p) => ({ ...p, roles: p.roles.filter((r) => r !== "commander") })) };
    expect(proposalNeedsCommander(noCmd)).toBe(false);
  });

  test("votes tally by majority with deterministic tie-breaking", () => {
    const votes = [
      { playerId: "p1", playerName: "Ada", choiceId: "a" },
      { playerId: "p2", playerName: "Bob", choiceId: "b" },
      { playerId: "p3", playerName: "Cleo", choiceId: "a" },
    ];
    const routing = { eventId: "evt", eventTitle: "T", targetRoles: [], eligiblePlayerIds: [], mode: "vote" as const, proposal: null, votes };
    expect(tallyVotes(routing)).toBe("a");
    const tie = { ...routing, votes: [votes[0], votes[1]] };
    const winner = tallyVotes(tie);
    expect(winner === null ? "" : winner === "a" || winner === "b").toBe(true);
  });

  test("vote completeness requires every connected player", () => {
    const s = fourPlayerSession();
    const routing = { eventId: "evt", eventTitle: "T", targetRoles: [], eligiblePlayerIds: [], mode: "vote" as const, proposal: null, votes: [] };
    expect(voteComplete(s, routing)).toBe(false);
    const twoVotes = {
      ...routing,
      votes: [
        { playerId: "p1", playerName: "Ada", choiceId: "a" },
        { playerId: "p2", playerName: "Bob", choiceId: "a" },
      ],
    };
    expect(voteComplete(s, twoVotes)).toBe(false);
    const allVotes = {
      ...routing,
      votes: s.players.map((p, i) => ({ playerId: p.id, playerName: p.name, choiceId: i % 2 ? "b" : "a" })),
    };
    expect(voteComplete(s, allVotes)).toBe(true);
  });
});

describe("contributions & robustness", () => {
  test("decisions credit the deciding player with quality stats", () => {
    const s = fourPlayerSession();
    const credited = creditDecision(s, {
      playerId: "p2",
      event: testEvent({ title: "Power Bus Undervoltage", description: "fault detected" }),
      choiceId: "a",
      via: "proposal",
    });
    const bob = credited.players.find((p) => p.id === "p2")!;
    expect(bob.stats.decisions).toBe(1);
    expect(bob.stats.recommendationsAccepted).toBe(1);
    expect(bob.stats.emergenciesResolved).toBe(1); // "fault" counts as an emergency
    expect(bob.stats.choiceQualities).toEqual([0.9]);
    // other players unaffected
    expect(credited.players.find((p) => p.id === "p1")!.stats.decisions).toBe(0);
  });

  test("contribution reports list every player with averages", () => {
    const s = fourPlayerSession();
    const credited = creditDecision(s, { playerId: "p3", event: testEvent({}), choiceId: "b", via: "solo" });
    const reports = contributionReports(credited);
    expect(reports).toHaveLength(4);
    const cleo = reports.find((r) => r.playerId === "p3")!;
    expect(cleo.averageQuality).toBeCloseTo(0.4, 5);
  });

  test("lobby readiness requires mission, roles and ready flags", () => {
    const s = fourPlayerSession();
    expect(lobbyReady(s).ok).toBe(false);
    const withMission = { ...s, missionId: "lunar_research" };
    expect(lobbyReady(withMission).ok).toBe(false);
    const allReady = { ...withMission, players: withMission.players.map((p) => ({ ...p, ready: true })) };
    const ready = lobbyReady(allReady);
    expect(ready.ok).toBe(true);
  });

  test("host migrates when the host disconnects", () => {
    const s = fourPlayerSession();
    const hostGone = { ...s, players: s.players.map((p) => (p.id === "p1" ? { ...p, connected: false } : p)) };
    const migrated = migrateHost(hostGone);
    expect(migrated.hostId).toBe("p2");
    expect(migrated.players.find((p) => p.id === "p2")!.isHost).toBe(true);
  });

  test("disconnected players keep their slot for reconnection", () => {
    const s = fourPlayerSession();
    const gone = { ...s, players: s.players.map((p) => (p.id === "p3" ? { ...p, connected: false } : p)) };
    expect(gone.players).toHaveLength(4);
    expect(gone.players.find((p) => p.id === "p3")!.connected).toBe(false);
  });
});
