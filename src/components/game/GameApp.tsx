"use client";

/**
 * GAME APP — the application shell and phase router.
 * v2.0: two modes — the original single-player loop (six phases) and the
 * cooperative multiplayer flow (entry → lobby → design → sim → report).
 * Screen transitions use framer-motion for polish.
 */

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StarfieldBackground } from "@/components/game/StarfieldBackground";
import { GameHeader } from "@/components/game/GameHeader";
import { DashboardScreen } from "@/components/game/screens/DashboardScreen";
import { BriefingScreen } from "@/components/game/screens/BriefingScreen";
import { DesignerScreen } from "@/components/game/screens/DesignerScreen";
import { ReadinessScreen } from "@/components/game/screens/ReadinessScreen";
import { SimulationScreen } from "@/components/game/screens/SimulationScreen";
import { ReportScreen } from "@/components/game/screens/ReportScreen";
import { LearnBasicsScreen } from "@/components/game/screens/LearnBasicsScreen";
import { ProgressScreen } from "@/components/game/screens/ProgressScreen";
import { MultiplayerApp } from "@/components/game/MultiplayerApp";
import { useGameStore } from "@/store/gameStore";
import { useMultiplayerStore } from "@/store/multiplayerStore";

const SCREENS = {
  dashboard: DashboardScreen,
  briefing: BriefingScreen,
  designer: DesignerScreen,
  readiness: ReadinessScreen,
  simulation: SimulationScreen,
  report: ReportScreen,
  learn: LearnBasicsScreen,
  progress: ProgressScreen,
} as const;

export function GameApp() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const setInviteCode = useMultiplayerStore((s) => s.setInviteCode);

  // Invite links look like  http://<host-ip>:3000/?join=ABCD
  // Opening one drops the player straight into the co-op entry screen with the
  // room code pre-filled (the server address defaults to the same host).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join");
    if (!code) return;
    setInviteCode(code);
    setMode("multiplayer");
    // Keep the address bar tidy so a reload doesn't re-trigger the invite.
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "multiplayer") {
    return (
      <TooltipProvider delayDuration={120}>
        <StarfieldBackground />
        <GameHeader />
        <main className="flex-1">
          <MultiplayerApp />
        </main>
        <footer className="mt-auto border-t border-primary/10 bg-background/60 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70">
              MISSION CONTROL: BEYOND EARTH — COOPERATIVE MISSION MODE
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
              UP TO 4 PLAYERS · LAN WEBSOCKET · HOST-AUTHORITATIVE
            </span>
          </div>
        </footer>
      </TooltipProvider>
    );
  }

  const Screen = SCREENS[phase];

  return (
    <TooltipProvider delayDuration={120}>
      <StarfieldBackground />
      <GameHeader />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="mt-auto border-t border-primary/10 bg-background/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70">
            MISSION CONTROL: BEYOND EARTH — EDUCATIONAL SPACE MISSION SIMULATOR
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
            BUILT FOR THE NASA SPACE APPS CHALLENGE · OPEN SOURCE (APACHE-2.0)
          </span>
        </div>
      </footer>
    </TooltipProvider>
  );
}
