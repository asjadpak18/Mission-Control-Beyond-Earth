"use client";

/**
 * SPACECRAFT DESIGNER — browse, add and remove equipment while every resource
 * updates live. v2.0: the interactive spacecraft canvas shows the actual
 * assembled vehicle, updating (animated) with every change; equipment cards
 * carry mission-compatibility indicators and respect constraint restrictions.
 */

import { useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, BatteryCharging, Boxes, ChevronLeft, ChevronRight, Coins,
  Compass, Fuel as FuelIcon, Minus, Microscope, Plus, RadioTower, Rocket, Scale, Search, Shield,
  Thermometer, Trash2, TriangleAlert, X, Zap, Ban, ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EQUIPMENT, EQUIPMENT_BY_ID, EQUIPMENT_CATEGORIES, getEquipment } from "@/lib/game/equipment";
import { computeResources, formatMass, formatMoney, installedQuantity } from "@/lib/game/calculations";
import { validateSpacecraft } from "@/lib/game/validation";
import type { Equipment, EquipmentCategory, Mission } from "@/lib/game/types";
import { useGameStore, currentMission } from "@/store/gameStore";
import { Chip, EduTooltip, StatBar } from "@/components/game/shared";
import { SpacecraftCanvas } from "@/components/game/SpacecraftCanvas";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<EquipmentCategory, React.ReactNode> = {
  Propulsion: <Rocket className="h-3.5 w-3.5" aria-hidden="true" />,
  Fuel: <FuelIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  Power: <Zap className="h-3.5 w-3.5" aria-hidden="true" />,
  Communication: <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />,
  Science: <Microscope className="h-3.5 w-3.5" aria-hidden="true" />,
  Navigation: <Compass className="h-3.5 w-3.5" aria-hidden="true" />,
  Thermal: <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />,
  Protection: <Shield className="h-3.5 w-3.5" aria-hidden="true" />,
  Landing: <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />,
  Structure: <Boxes className="h-3.5 w-3.5" aria-hidden="true" />,
};

function equipmentHighlights(e: Equipment): string[] {
  const parts: string[] = [];
  if (e.powerGeneration > 0) parts.push(`+${e.powerGeneration} W${e.isSolar ? " solar" : ""}`);
  if (e.powerConsumption > 0) parts.push(`−${e.powerConsumption} W`);
  if (e.fuelCapacity > 0) parts.push(`${e.fuelCapacity.toLocaleString()} kg fuel`);
  if (e.propulsion > 0) parts.push(`${e.propulsion} thrust`);
  if (e.fuelConsumption > 0) parts.push(`${e.fuelConsumption} kg/pt burn`);
  if (e.scienceOutput > 0) parts.push(`${e.scienceOutput} science`);
  if (e.commCapability > 0) parts.push(`${e.commCapability} comm`);
  if (e.navigation > 0) parts.push(`${e.navigation} nav`);
  if (e.radiationShielding > 0) parts.push(`${e.radiationShielding}% rad shield`);
  if (e.thermalProtection > 0) parts.push(`${e.thermalProtection}% thermal`);
  if (e.landingAssist > 0) parts.push(`${e.landingAssist} landing`);
  if (e.powerStorage > 0) parts.push(`${e.powerStorage} Wh battery`);
  if (e.structural > 0) parts.push(`${e.structural} structure`);
  return parts;
}

/** Mission-fit verdict for an equipment card (compatibility indicators). */
function compatibility(e: Equipment, mission: Mission): { tone: "good" | "warn" | "bad"; label: string } | null {
  if (mission.bannedEquipmentIds?.includes(e.id)) {
    return { tone: "bad", label: "UNAVAILABLE THIS ATTEMPT" };
  }
  if (e.isSolar && mission.solarDerate < 0.3) {
    return { tone: "warn", label: `WEAK AT ${mission.destination.toUpperCase()} (${Math.round(mission.solarDerate * 100)}% SUN)` };
  }
  if (e.radiationShielding > 0 && mission.minRadiation > 0 && e.radiationShielding >= 50) {
    return { tone: "good", label: "RECOMMENDED — RADIATION ZONE" };
  }
  if (e.thermalProtection >= 85 && mission.minThermal > 0) {
    return { tone: "good", label: "RECOMMENDED — ATMOSPHERIC ENTRY" };
  }
  if (e.landingAssist >= 45 && mission.minLanding > 0) {
    return { tone: "good", label: "RECOMMENDED — SURFACE MISSION" };
  }
  if (e.navigation >= 55 && mission.minNavigation > 0) {
    return { tone: "good", label: "RECOMMENDED — PRECISION TRAJECTORY" };
  }
  if (e.commCapability >= 100 && (mission.solarDerate < 0.3 || mission.destination.includes("Deep"))) {
    return { tone: "good", label: "RECOMMENDED — LONG RANGE" };
  }
  if (e.scienceOutput >= 50 && mission.objectives.some((o) => o.target.kind === "scienceData")) {
    return { tone: "good", label: "STRONG SCIENCE RETURN" };
  }
  return null;
}

function EquipmentCard({ equipment, mission }: { equipment: Equipment; mission: Mission }) {
  const adjustQuantity = useGameStore((s) => s.adjustQuantity);
  const design = useGameStore((s) => (s.missionId ? s.designs[s.missionId] : undefined));
  const qty = design ? installedQuantity(design, equipment.id) : 0;
  const banned = mission.bannedEquipmentIds?.includes(equipment.id) ?? false;
  const compat = compatibility(equipment, mission);

  return (
    <div
      className={cn(
        "panel group flex flex-col gap-2.5 p-3.5 transition-all duration-200",
        qty > 0 ? "border-accent/50 shadow-[0_0_18px_rgba(0,163,255,0.12)]" : "hover:border-primary/40",
        banned && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-accent/80">{CATEGORY_ICONS[equipment.category]}</span>
            <h4 className="truncate text-[13px] font-semibold leading-tight text-foreground">{equipment.name}</h4>
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {equipment.category} · REL {equipment.reliability}%
          </div>
        </div>
        {qty > 0 ? (
          <span className="shrink-0 rounded-full border border-accent/50 bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
            ×{qty}
          </span>
        ) : null}
      </div>

      <p className="line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{equipment.description}</p>
      <p className="line-clamp-2 border-l-2 border-accent/40 pl-2 text-[11px] italic leading-relaxed text-cyan-200/70">
        Trade-off: {equipment.tradeoff}
      </p>

      {compat ? (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9.5px] font-semibold tracking-wide",
            compat.tone === "good" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
            compat.tone === "warn" && "border-amber-400/40 bg-amber-400/10 text-amber-300",
            compat.tone === "bad" && "border-rose-400/40 bg-rose-400/10 text-rose-300"
          )}
        >
          {compat.tone === "bad" ? <Ban className="h-3 w-3" aria-hidden="true" /> : <ThumbsUp className="h-3 w-3" aria-hidden="true" />}
          {compat.label}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {equipmentHighlights(equipment).map((h) => (
          <span key={h} className="rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200/90">
            {h}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-primary/15 pt-2.5">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-amber-300">
            <Coins className="h-3 w-3" aria-hidden="true" />
            {formatMoney(equipment.cost)}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-sky-300/90">
            <Scale className="h-3 w-3" aria-hidden="true" />
            {equipment.mass} kg
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-primary/40 text-cyan-100 hover:bg-[#123156]"
            disabled={qty === 0}
            onClick={() => adjustQuantity(equipment.id, -1)}
            aria-label={`Remove one ${equipment.name}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-7 px-3 font-mono text-[11px] font-bold",
              qty === 0
                ? "bg-primary/80 hover:bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/90"
            )}
            disabled={banned}
            onClick={() => adjustQuantity(equipment.id, 1)}
            aria-label={banned ? `${equipment.name} is unavailable for this attempt` : `Add one ${equipment.name}`}
          >
            <Plus className="mr-0.5 h-3.5 w-3.5" /> {banned ? "N/A" : "ADD"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InstalledRow({ equipmentId, quantity }: { equipmentId: string; quantity: number }) {
  const adjustQuantity = useGameStore((s) => s.adjustQuantity);
  const setQuantity = useGameStore((s) => s.setQuantity);
  const eq = getEquipment(equipmentId);
  if (!eq || quantity <= 0) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-primary/15 bg-secondary/40 px-3 py-2">
      <span className="text-accent/80">{CATEGORY_ICONS[eq.category]}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-foreground">{eq.name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {formatMoney(eq.cost * quantity)} · {eq.mass * quantity} kg
          {eq.fuelCapacity > 0 ? ` · ${eq.fuelCapacity * quantity} kg fuel` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6 border-primary/30"
          onClick={() => adjustQuantity(eq.id, -1)}
          aria-label={`Decrease ${eq.name} quantity`}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <span className="w-7 text-center font-mono text-sm font-bold text-accent" aria-label={`Quantity: ${quantity}`}>
          {quantity}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6 border-primary/30"
          onClick={() => adjustQuantity(eq.id, 1)}
          aria-label={`Increase ${eq.name} quantity`}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-rose-300/70 hover:bg-rose-400/10 hover:text-rose-300"
          onClick={() => setQuantity(eq.id, 0)}
          aria-label={`Remove all ${eq.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function DesignerScreen() {
  const missionId = useGameStore((s) => s.missionId);
  const difficulty = useGameStore((s) => s.difficulty);
  const constraintIds = useGameStore((s) => s.constraintIds);
  const constraintSeed = useGameStore((s) => s.constraintSeed);
  const goTo = useGameStore((s) => s.goTo);
  const design = useGameStore((s) => (s.missionId ? s.designs[s.missionId] : undefined));
  const clearDesign = useGameStore((s) => s.clearDesign);
  const [category, setCategory] = useState<EquipmentCategory | "All">("All");
  const [search, setSearch] = useState("");

  const mission = useMemo(
    () => (missionId ? currentMission({ missionId, difficulty, constraintIds, constraintSeed }) : null),
    [missionId, difficulty, constraintIds, constraintSeed]
  );

  const resources = useMemo(
    () => (mission && design ? computeResources(mission, design) : null),
    [mission, design]
  );
  const validation = useMemo(
    () => (mission && design ? validateSpacecraft(mission, design) : null),
    [mission, design]
  );

  if (!mission || !design || !resources || !validation) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted-foreground">No mission selected.</p>
        <Button className="mt-4" onClick={() => goTo("dashboard")}>
          Return to mission selection
        </Button>
      </div>
    );
  }

  const filtered = EQUIPMENT.filter((e) => {
    const matchesCategory = category === "All" || e.category === category;
    const matchesSearch =
      search.trim().length === 0 ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const fuelOver = resources.fuelCapacity < resources.fuelRequired;
  const powerBad = resources.powerBalance < 0 || resources.powerGeneratedEffective < mission.minPower;
  const derated = mission.solarDerate < 0.99;
  const installed = design.components.filter((c) => c.quantity > 0);
  const constraintBadges = mission.appliedConstraintIds ?? [];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 pb-16 sm:px-6">
      {/* Header */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            STEP 02 — SPACECRAFT CONSTRUCTION · {mission.name.toUpperCase()}
          </div>
          <h1 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">Assembly Bay</h1>
          {constraintBadges.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {constraintBadges.map((id) => (
                <span key={id} className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-amber-300">
                  CONSTRAINT · {id.replace(/_/g, " ").toUpperCase()}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => goTo("briefing")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Briefing
          </Button>
          <Button
            size="lg"
            className={cn(
              "font-display h-11 px-6 text-sm font-bold tracking-wider",
              validation.errors.length === 0 && installed.length > 0
                ? "launch-glow bg-gradient-to-r from-primary to-accent text-[#04070f] hover:from-primary/90 hover:to-accent/90"
                : "bg-primary/70 text-primary-foreground hover:bg-primary/80"
            )}
            onClick={() => goTo("readiness")}
          >
            READINESS REVIEW
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Mobile quick stats */}
      <div className="panel mt-4 grid grid-cols-2 gap-2 p-3 lg:hidden">
        <Chip label="BUDGET" value={`${formatMoney(resources.budgetRemaining)} left`} tone={resources.budgetRemaining < 0 ? "bad" : "default"} />
        <Chip label="MASS" value={`${resources.massRemaining.toLocaleString()} kg left`} tone={resources.massRemaining < 0 ? "bad" : "default"} />
        <Chip
          label="POWER"
          value={`${resources.powerBalance >= 0 ? "+" : ""}${resources.powerBalance} W`}
          tone={powerBad ? "bad" : "good"}
        />
        <Chip
          label="FUEL"
          value={`${resources.fuelCapacity.toLocaleString()}/${resources.fuelRequired.toLocaleString()} kg`}
          tone={fuelOver ? "bad" : "good"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.7fr)_340px]">
        {/* ------------------- Catalogue ------------------- */}
        <section className="panel flex flex-col overflow-hidden">
          <div className="space-y-3 border-b border-primary/15 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search components…"
                className="border-primary/25 bg-secondary/40 pl-9 text-[13px]"
                aria-label="Search equipment catalogue"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("All")}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide transition-colors",
                  category === "All"
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-primary/20 text-muted-foreground hover:border-primary/40 hover:text-cyan-200"
                )}
              >
                ALL ({EQUIPMENT.length})
              </button>
              {EQUIPMENT_CATEGORIES.map((cat) => {
                const count = EQUIPMENT.filter((e) => e.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide transition-colors",
                      category === cat
                        ? "border-accent/60 bg-accent/15 text-accent"
                        : "border-primary/20 text-muted-foreground hover:border-primary/40 hover:text-cyan-200"
                    )}
                  >
                    {CATEGORY_ICONS[cat]}
                    {cat.toUpperCase()} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid max-h-[calc(100vh-22rem)] gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((e) => (
              <EquipmentCard key={e.id} equipment={e} mission={mission} />
            ))}
            {filtered.length === 0 ? (
              <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
                No components match your search.
              </div>
            ) : null}
          </div>
        </section>

        {/* ------------------- Spacecraft model + installed list ------------------- */}
        <section className="flex min-h-0 flex-col gap-4">
          <SpacecraftCanvas config={design} missionName={mission.name} className="shrink-0" />
          <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-primary/15 p-4">
              <div>
                <div className="font-display text-sm font-bold text-foreground">Installed Manifest</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {installed.reduce((s, c) => s + c.quantity, 0)} COMPONENTS · {resources.totalMass.toLocaleString()} kg ·{" "}
                  {formatMoney(resources.totalCost)}
                </div>
              </div>
            {installed.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-300/80 hover:bg-rose-400/10 hover:text-rose-300"
                onClick={clearDesign}
              >
                <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> CLEAR
              </Button>
            ) : null}
          </div>
          <div className="max-h-[calc(100vh-22rem)] flex-1 space-y-2 overflow-y-auto p-4">
            {installed.length === 0 ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-center">
                <Rocket className="h-10 w-10 text-primary/30" aria-hidden="true" />
                <p className="max-w-52 text-xs leading-relaxed text-muted-foreground">
                  Nothing installed. Add an engine, a power source, fuel and instruments from the catalogue.
                </p>
              </div>
            ) : (
              EQUIPMENT_CATEGORIES.map((cat) => {
                const rows = installed.filter((c) => EQUIPMENT_BY_ID[c.equipmentId]?.category === cat);
                if (rows.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {CATEGORY_ICONS[cat]} {cat}
                    </div>
                    {rows.map((c) => (
                      <InstalledRow key={c.equipmentId} equipmentId={c.equipmentId} quantity={c.quantity} />
                    ))}
                  </div>
                );
              })
            )}
          </div>
          </div>
        </section>

        {/* ------------------- Live resources ------------------- */}
        <section className="panel hud-corners flex flex-col gap-4 p-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6.5rem)] xl:overflow-y-auto">
          <div>
            <div className="font-display text-sm font-bold text-foreground">Live Engineering Stats</div>
            <div className="font-mono text-[10px] text-muted-foreground">UPDATES WITH EVERY CHANGE</div>
          </div>

          <div className="space-y-3.5">
            <StatBar
              label="Budget used"
              value={resources.totalCost}
              max={mission.budget}
              display={`${formatMoney(resources.budgetRemaining)} remaining`}
              invert
              hint="Total component cost must stay within the mission budget."
            />
            <StatBar
              label="Mass"
              value={resources.totalMass}
              max={mission.maxMass}
              display={`${resources.massRemaining.toLocaleString()} kg remaining`}
              invert
              hint="Every component adds mass. The launch vehicle cannot lift more than the maximum."
            />
            <StatBar
              label="Propellant"
              value={resources.fuelRequired}
              max={Math.max(resources.fuelCapacity, resources.fuelRequired, 1)}
              display={
                fuelOver
                  ? `short ${resources.fuelRequired - resources.fuelCapacity} kg`
                  : `${(resources.fuelCapacity - resources.fuelRequired).toLocaleString()} kg reserve`
              }
              invert
              hint="Tanks must carry at least the propellant this engine configuration burns for the mission profile."
            />

            <div className="rounded-md border border-primary/20 bg-secondary/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BatteryCharging className="h-3.5 w-3.5 text-accent/80" aria-hidden="true" /> Electrical power
                  <EduTooltip
                    text={
                      derated
                        ? `At ${mission.destination} solar arrays deliver only ${Math.round(mission.solarDerate * 100)}% of their rating. RTGs are unaffected by distance.`
                        : "Generation must exceed consumption, or systems brown out mid-flight."
                    }
                  />
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold",
                    powerBad ? "text-rose-300" : "text-emerald-300"
                  )}
                >
                  {resources.powerBalance >= 0 ? "+" : ""}
                  {resources.powerBalance} W
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-cyan-200/90">
                  <span>Generation (effective)</span>
                  <span>{resources.powerGeneratedEffective} W</span>
                </div>
                {derated ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Generation (nominal, 1 AU)</span>
                    <span>{resources.powerGenerated} W</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-amber-200/80">
                  <span>Consumption</span>
                  <span>−{resources.powerConsumed} W</span>
                </div>
                {resources.powerStorage > 0 ? (
                  <div className="flex justify-between text-emerald-200/70">
                    <span>Battery buffer</span>
                    <span>{resources.powerStorage} Wh</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Chip label="THRUST" value={`${resources.propulsion}/${mission.minPropulsion}`} tone={resources.propulsion >= mission.minPropulsion ? "good" : "bad"} />
              <Chip label="SCIENCE" value={`${resources.scienceCapability}`} />
              <Chip label="COMM" value={`${resources.commCapability}`} />
              <Chip label="NAV" value={`${resources.navigation}/${mission.minNavigation}`} tone={mission.minNavigation === 0 || resources.navigation >= mission.minNavigation ? "good" : "bad"} />
              {mission.minLanding > 0 ? (
                <Chip label="LANDING" value={`${resources.landingAssist}/${mission.minLanding}`} tone={resources.landingAssist >= mission.minLanding ? "good" : "bad"} />
              ) : null}
              {mission.minThermal > 0 ? (
                <Chip label="THERMAL" value={`${resources.thermalProtection}/${mission.minThermal}%`} tone={resources.thermalProtection >= mission.minThermal ? "good" : "bad"} />
              ) : null}
              {mission.minRadiation > 0 ? (
                <Chip label="RADIATION" value={`${resources.radiationShielding}/${mission.minRadiation}%`} tone={resources.radiationShielding >= mission.minRadiation ? "good" : "bad"} />
              ) : null}
              <Chip
                label="RELIABILITY"
                value={`${resources.reliability}%`}
                tone={resources.reliability >= 85 ? "good" : resources.reliability >= 75 ? "warn" : "bad"}
              />
            </div>
          </div>

          {/* Live readiness summary */}
          <div
            className={cn(
              "rounded-md border p-3",
              validation.errors.length > 0
                ? "border-rose-400/40 bg-rose-400/5"
                : "border-emerald-400/40 bg-emerald-400/5"
            )}
          >
            {validation.errors.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-rose-300">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  {validation.errors.length} LAUNCH BLOCKER{validation.errors.length === 1 ? "" : "S"}
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {validation.errors.slice(0, 4).map((e) => (
                    <li key={e.id} className="text-[11px] leading-snug text-rose-200/80">
                      · {e.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="font-mono text-[11px] font-bold text-emerald-300">
                ✓ ALL ESSENTIAL CHECKS PASS — READY FOR READINESS REVIEW
              </div>
            )}
            {validation.warnings.length > 0 ? (
              <div className="mt-2 border-t border-primary/15 pt-2 font-mono text-[10px] text-amber-300/80">
                {validation.warnings.length} ADVISOR{validation.warnings.length === 1 ? "Y" : "IES"} — SEE READINESS REVIEW
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
