/**
 * ============================================================================
 * MULTIPLAYER END-TO-END TEST — real server, four real clients
 * ============================================================================
 * Spawns the multiplayer server as a subprocess and drives a COMPLETE
 * four-player cooperative session through real WebSocket messages:
 *
 *   create → join ×3 → role claiming → mission + difficulty → ready →
 *   start → shared design → launch → all 8 stages (with decisions:
 *   solo / proposal / vote) → finish → team score + contributions →
 *   disconnect → reconnect → host migration → play again.
 *
 * Run with: bun tests/multiplayer-e2e.ts
 * ============================================================================
 */

import { spawn, type ChildProcess } from "node:child_process";

const PORT = 3199;
const URL = `ws://localhost:${PORT}`;

let passed = 0;
let failed = 0;
function ok(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  (pass) ${label}`);
  } else {
    failed++;
    console.error(`  (FAIL) ${label}`);
  }
}

interface TestClient {
  ws: WebSocket;
  playerId: string;
  token: string;
  session: any;
  errors: string[];
  nextId: number;
  history: any[];
  waiters: Array<{ resolve: (v: any) => void; test: (msg: any) => boolean }>;
}

function connectClient(name: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const client: TestClient = { ws, playerId: "", token: "", session: null, errors: [], nextId: 1, history: [], waiters: [] };
    ws.onopen = () => resolve(client);
    ws.onerror = (e) => reject(new Error(`${name}: socket error ${String(e)}`));
    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      client.history.push(msg);
      if (client.history.length > 500) client.history.splice(0, 250);
      if (msg.t === "joined") {
        client.playerId = msg.playerId;
        client.token = msg.token;
        client.session = msg.session;
      } else if (msg.t === "session") {
        client.session = msg.session;
      } else if (msg.t === "error") {
        client.errors.push(msg.message);
      }
      for (let i = client.waiters.length - 1; i >= 0; i--) {
        if (client.waiters[i].test(msg)) {
          const w = client.waiters.splice(i, 1)[0];
          w.resolve(msg);
        }
      }
    };
  });
}

function send(client: TestClient, message: Record<string, unknown>) {
  client.ws.send(JSON.stringify(message));
}

/** Wait until a message matching `test` arrives (checks history first). */
function waitFor(client: TestClient, test: (msg: any) => boolean, timeoutMs = 8000): Promise<any> {
  const already = client.history.find(test);
  if (already) return Promise.resolve(already);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("waitFor timeout")), timeoutMs);
    const w = { resolve: (v: any) => { clearTimeout(timer); resolve(v); }, test };
    client.waiters.push(w);
  });
}

/** Wait until the mirrored session satisfies `pred`. */
function waitForSession(client: TestClient, pred: (s: any) => boolean, timeoutMs = 10000): Promise<any> {
  return waitFor(client, (msg) => msg.t === "session" && pred(msg.session), timeoutMs);
}

async function main() {
  console.log("Multiplayer E2E — spawning server…");
  const server: ChildProcess = spawn("bun", ["server/multiplayer-server.ts"], {
    env: { ...process.env, MULTIPLAYER_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (d) => process.env.MP_VERBOSE ? console.log(`[server] ${d}`) : undefined);
  server.stderr?.on("data", (d) => console.error(`[server] ${d}`));

  // Wait for the health endpoint.
  let up = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) { up = true; break; }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  ok(up, "server starts and answers /health");
  if (!up) { server.kill(); process.exit(1); }

  try {
    // ---------------------------------------------------------------- connect
    console.log("\nPhase 1 — connections");
    const host = await connectClient("host");
    send(host, { t: "create", name: "Ada" });
    await waitFor(host, (m) => m.t === "joined");
    const roomCode: string = host.session.code;
    ok(roomCode?.length === 4, `host created room ${roomCode}`);

    const bob = await connectClient("bob");
    const cleo = await connectClient("cleo");
    const dee = await connectClient("dee");
    send(bob, { t: "join", roomCode, name: "Bob" });
    send(cleo, { t: "join", roomCode, name: "Cleo" });
    send(dee, { t: "join", roomCode, name: "Dee" });
    await waitFor(bob, (m) => m.t === "joined");
    await waitFor(cleo, (m) => m.t === "joined");
    await waitFor(dee, (m) => m.t === "joined");
    await waitForSession(host, (s) => s.players.length === 4);
    ok(host.session.players.length === 4, "four players in the room");

    // Fifth player rejected (cap).
    const extra = await connectClient("extra");
    send(extra, { t: "join", roomCode, name: "Eve" });
    await waitFor(extra, (m) => m.t === "error" && /full/i.test(m.message));
    ok(true, "fifth player is rejected (4-player cap)");
    extra.ws.close();

    // ---------------------------------------------------------------- roles
    console.log("\nPhase 2 — roles & lobby");
    send(host, { t: "set_role", role: "commander", on: true });
    send(bob, { t: "set_role", role: "engineer", on: true });
    send(cleo, { t: "set_role", role: "navigator", on: true });
    send(dee, { t: "set_role", role: "scientist", on: true });
    await waitForSession(host, (s) => s.players.every((p: any) => p.roles.length === 1));
    ok(true, "all four roles claimed");

    send(host, { t: "select_mission", missionId: "lunar_research" });
    await waitForSession(dee, (s) => s.missionId === "lunar_research");
    ok(true, "host selected Lunar Research Expedition");

    // Non-host cannot select.
    send(bob, { t: "select_mission", missionId: "mars_survey" });
    await waitFor(bob, (m) => m.t === "error" && /host/i.test(m.message));
    ok(true, "non-host cannot select the mission");

    send(host, { t: "set_difficulty", difficulty: "Beginner", constraintIds: [], constraintSeed: 7 });
    await waitForSession(host, (s) => s.difficulty === "Beginner");
    ok(true, "difficulty set to Beginner (calmer events for a deterministic test)");

    send(host, { t: "set_ready", ready: true });
    send(bob, { t: "set_ready", ready: true });
    send(cleo, { t: "set_ready", ready: true });
    send(dee, { t: "set_ready", ready: true });
    await waitForSession(host, (s) => s.players.every((p: any) => p.ready));

    // Host starts; everyone sees design phase.
    send(host, { t: "start" });
    await waitForSession(dee, (s) => s.phase === "design");
    ok(true, "session moved to the shared design phase");

    // ---------------------------------------------------------------- design
    console.log("\nPhase 3 — shared spacecraft design");
    // A flight-proven lunar configuration, assembled by DIFFERENT players.
    const parts: Array<[string, string, number]> = [
      [host.playerId, "science_instrument", 1],
      [bob.playerId, "communication_antenna", 1],
      [cleo.playerId, "chemical_engine", 1],
      [dee.playerId, "fuel_tank_large", 1],
      [bob.playerId, "solar_array", 1],
    ];
    for (const [pid, equipmentId, quantity] of parts) {
      const client = [host, bob, cleo, dee].find((c) => c.playerId === pid)!;
      send(client, { t: "set_quantity", equipmentId, quantity });
    }
    await waitForSession(host, (s) => s.design.components.length === 5);
    ok(host.session.design.components.length === 5, "all four players edited the shared design");

    // Launch must succeed (Beginner: generous budget).
    const launchWaiter = waitForSession(host, (s) => s.phase === "simulation", 15000);
    send(host, { t: "launch" });
    await launchWaiter;
    ok(!!host.session.simulation, "launch accepted — authoritative simulation created");
    ok(typeof host.session.seed === "number", `mission seed generated (${host.session.seed})`);

    // ---------------------------------------------------------------- flight
    console.log("\nPhase 4 — cooperative flight");
    let guard = 0;
    const clients = [host, bob, cleo, dee];
    let decided = 0;

    const driveSimulation = async () => {
      for (;;) {
        const s: any = host.session;
        if (s.phase !== "simulation" || !s.simulation) break;
        const sim = s.simulation;
        if (sim.stagePhase === "complete" || sim.status === "failure") break;
        if (guard++ > 200) throw new Error("simulation loop guard tripped");

        if (sim.stagePhase === "awaiting_event" && s.routing) {
          const routing = s.routing;
          const event = sim.pendingEvent.event;
          if (routing.mode === "vote") {
            // Everyone votes for the first choice.
            for (const c of clients) {
              if (!routing.votes.some((v: any) => v.playerId === c.playerId)) {
                send(c, { t: "vote", choiceId: event.choices[0].id });
                await new Promise((r) => setTimeout(r, 80));
              }
            }
            // Server auto-closes when all connected voted; otherwise nudge.
            await waitForSession(host, (st) => st.simulation?.stagePhase !== "awaiting_event" || st.routing === null, 6000).catch(() => {
              send(host, { t: "resolve_vote" });
            });
            decided++;
          } else if (routing.mode === "proposal") {
            const proposerId = routing.eligiblePlayerIds[0];
            const proposer = clients.find((c) => c.playerId === proposerId) ?? host;
            send(proposer, { t: "propose", choiceId: event.choices[0].id });
            await waitForSession(host, (st) => st.routing?.proposal !== null || st.routing === null, 6000);
            if (host.session.routing?.proposal) {
              // Commander approves.
              send(host, { t: "approve", accept: true });
            }
            decided++;
          } else {
            const deciderId = routing.eligiblePlayerIds[0];
            const decider = clients.find((c) => c.playerId === deciderId) ?? host;
            send(decider, { t: "decide", choiceId: event.choices[0].id });
            decided++;
          }
          await waitForSession(host, (st) => st.simulation?.stagePhase !== "awaiting_event" || st.routing === null, 6000);
        } else {
          // Any player advances the stage — rotate through the crew.
          const who = clients[guard % clients.length];
          send(who, { t: "advance" });
          await waitForSession(host, (st) => {
            const sim2 = st.simulation;
            if (!sim2) return false;
            return sim2.stageLog.length > (sim.stageLog?.length ?? 0) || sim2.stagePhase === "awaiting_event" || sim2.stagePhase === "complete" || sim2.status === "failure";
          }, 6000);
        }
        await new Promise((r) => setTimeout(r, 60));
      }
    };

    await driveSimulation();
    const finalSim = host.session.simulation;
    ok(finalSim.stagePhase === "complete" || finalSim.status === "failure", "flight reached an end state");
    console.log(`    stages executed: ${finalSim.stageLog.length}, decisions: ${decided}, status: ${finalSim.status}`);

    // Every client saw the same mission state.
    const states = clients.map((c) => c.session.simulation);
    ok(
      states.every((s) => s && s.stageLog.length === finalSim.stageLog.length && s.fuelRemaining === finalSim.fuelRemaining),
      "all four clients share the identical mission state"
    );

    // ---------------------------------------------------------------- finish
    console.log("\nPhase 5 — report");
    send(host, { t: "finish" });
    await waitForSession(bob, (s) => s.phase === "report" && !!s.result);
    const result = bob.session.result;
    ok(!!result, "team mission report generated");
    ok(result.score >= 0 && result.score <= 1000, `team score ${result.score}/1000`);
    ok(bob.session.players.every((p: any) => typeof p.stats.decisions === "number"), "per-player contribution stats present");
    const totalDecisions = bob.session.players.reduce((s: number, p: any) => s + p.stats.decisions, 0);
    ok(totalDecisions === result.decisions.length, `contributions (${totalDecisions}) match engine decisions (${result.decisions.length})`);

    // ---------------------------------------------------------------- robustness
    console.log("\nPhase 6 — disconnection, reconnection, host migration");
    // Dee disconnects mid-report; her seat is held.
    const deeToken = dee.token;
    dee.ws.close();
    await waitForSession(host, (s) => s.players.find((p: any) => p.id === deeToken)?.connected === false);
    ok(true, "disconnected player marked offline, seat held");

    // Host leaves entirely → host migration to Bob.
    host.ws.close();
    await waitForSession(bob, (s) => s.hostId === bob.playerId);
    ok(true, "host migrated to the next connected player");

    // Dee reconnects with her token.
    const dee2 = await connectClient("dee-rejoin");
    send(dee2, { t: "join", roomCode, name: "Dee", token: deeToken });
    await waitFor(dee2, (m) => m.t === "joined" && m.playerId === deeToken);
    await waitForSession(bob, (s) => s.players.find((p: any) => p.id === deeToken)?.connected === true);
    ok(true, "player reconnected into their original seat (same id, same stats)");

    // New host returns the team to the lobby.
    send(bob, { t: "again" });
    await waitForSession(dee2, (s) => s.phase === "lobby" && !s.result);
    ok(true, "team returned to the lobby for another mission");

    console.log(`\n  ${passed} passed, ${failed} failed`);
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 300));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E harness crashed:", err);
  process.exit(1);
});
