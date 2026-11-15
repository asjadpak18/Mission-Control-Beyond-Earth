"use client";

/**
 * ============================================================================
 * SPACECRAFT PARTS — SVG artwork for every visual part of the shared model
 * ============================================================================
 * Each component renders ONE SpacecraftPart centred on its local origin
 * (the diagram positions it with translate(x, mountY − y)). Parts react to
 * the live flight state:
 *
 *   engineOn / throttle / sputter → real flame behaviour (thrust loss on
 *     malfunction is VISIBLE: the plume shrinks and stutters)
 *   deploy (0→1)  → solar wings unfold, antenna masts rise
 *   damaged       → scorched panels, flickering pods, warning sparks
 *   commFail      → dish stops tracking, red status LED, no signal rings
 *
 * v2.2 — Spacecraft Design System Refinement:
 *   - every side-mounted part draws a visible MOUNT BRACKET (arm, foot plate
 *     and bolts, or angled struts when it hangs below the hull section), so
 *     nothing floats disconnected beside the spacecraft;
 *   - tanks are domed cylinder sections with weld rings and gradient shading;
 *   - engines hang from a shared boat-tail ENGINE BAY thrust structure;
 *   - a conic ADAPTER joins the tank stack to the wider bus;
 *   - the heat shield is a mounting collar + struts INTEGRATED into the base;
 *   - radiation shielding is an armoured shell encapsulating the bus.
 *
 * All animation is CSS class driven (see globals.css) and every class is
 * disabled under prefers-reduced-motion.
 * ============================================================================
 */

import type { SpacecraftPart } from "./model";

export interface PartRenderState {
  motionOk: boolean;
  /** Engines firing (launch, insertion burns, lander descent). */
  engineOn: boolean;
  /** 0..1 — flame length / plume intensity. */
  throttle: number;
  /** Engine malfunction → erratic, weakened plume. */
  sputter: boolean;
  /** 0..1 — deployment progress of wings and masts (0 = stowed). */
  deploy: number;
  /** This specific part is damaged. */
  damaged: boolean;
  /** Communication subsystem offline. */
  commFail: boolean;
}

export const DEFAULT_PART_STATE: PartRenderState = {
  motionOk: true,
  engineOn: false,
  throttle: 1,
  sputter: false,
  deploy: 1,
  damaged: false,
  commFail: false,
};

// Artwork palette (shared with the previous v2.0 canvas)
const HULL_LIGHT = "#9fb8d4";
const HULL_MID = "#5f7794";
const HULL_DARK = "#31435c";
const PANEL_EDGE = "#66caff";
const GOLD = "#d9a441";
const GOLD_DARK = "#8a6420";
const ION_BLUE = "#57e6ff";
const NOZZLE = "#3b3f4a";
const NOZZLE_INNER = "#1c1f26";
const THRUST_GLOW = "rgba(255,176,32,0.55)";

// ---------------------------------------------------------------------------
// Mount bracket — the visible connection between a side part and the hull
// ---------------------------------------------------------------------------

/**
 * Draws the structural connection for a side-mounted part:
 *  - on-hull parts get a horizontal arm with a bolted foot plate;
 *  - parts hanging below the hull section get angled struts rising to the
 *    section's bottom corner (under-hung pannier style, like real landers).
 */
function MountBracket({ part, armY = 0 }: { part: SpacecraftPart; armY?: number }) {
  const dir = part.side === "l" ? -1 : 1;
  const so = part.standoff ?? 5;
  // Edge of the part facing the hull (local x). Art is drawn symmetric; the
  // hull lies on the −dir side of the part.
  const inner = dir > 0 ? -part.w / 2 : part.w / 2;
  const hullX = inner - dir * so;
  const hullBottomLocal = part.hullBottomY !== undefined ? part.y - part.hullBottomY : null;
  // The part sits ON the hull section when its centre is at (or barely below)
  // the section's bottom edge — hullBottomLocal is then ≥ 0.
  const onHull = hullBottomLocal === null || hullBottomLocal >= -2;

  if (onHull) {
    return (
      <g>
        {/* Arm from the part to the hull wall */}
        <rect
          x={Math.min(inner, hullX)}
          y={armY - 1.5}
          width={Math.max(so, 1)}
          height={3}
          fill={HULL_MID}
          stroke={HULL_DARK}
          strokeWidth="0.5"
        />
        {/* Bolted foot plate on the hull */}
        <rect x={dir > 0 ? hullX : hullX - 3.5} y={armY - 4.5} width={3.5} height={9} rx="0.8" fill={HULL_DARK} />
        <circle cx={inner - dir * so * 0.45} cy={armY - 1.5} r="0.7" fill={HULL_DARK} />
        <circle cx={inner - dir * so * 0.45} cy={armY + 1.5} r="0.7" fill={HULL_DARK} />
      </g>
    );
  }

  // Hanging below the section — angled struts up to the hull bottom corner.
  const cornerY = hullBottomLocal ?? -part.h / 2;
  return (
    <g>
      <path
        d={`M ${inner + dir * 2} ${-part.h / 2} L ${hullX} ${cornerY}`}
        stroke={HULL_MID}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${inner + dir * 9} ${-part.h / 2} L ${hullX + dir * 1.5} ${cornerY}`}
        stroke={HULL_MID}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <circle cx={hullX} cy={cornerY} r="1.7" fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.6" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Engine flame — reusable (also used by the launch scene plume)
// ---------------------------------------------------------------------------

export function EngineFlame({
  throttle,
  sputter,
  motionOk,
  wide = false,
}: {
  throttle: number;
  sputter: boolean;
  motionOk: boolean;
  wide?: boolean;
}) {
  if (throttle <= 0.02) return null;
  const t = Math.max(0.15, Math.min(1, throttle));
  const len = (wide ? 40 : 30) * t;
  const w = (wide ? 12 : 9) * (0.65 + 0.35 * t);
  const flicker = motionOk && !sputter ? "flame-flicker" : undefined;
  const stutter = motionOk && sputter ? "flame-sputter" : undefined;
  const opacity = sputter ? 0.55 : 0.95;
  return (
    <g>
      <path
        className={flicker ?? stutter}
        style={{ transformOrigin: "0px 0px", transformBox: "fill-box" }}
        d={`M ${-w} 0 Q ${-w * 0.5} ${len * 0.6} 0 ${len} Q ${w * 0.5} ${len * 0.6} ${w} 0 Z`}
        fill="#ffb020"
        opacity={opacity}
      />
      <path
        className={flicker ?? stutter}
        style={{ transformOrigin: "0px 0px", transformBox: "fill-box", animationDelay: "0.06s" }}
        d={`M ${-w * 0.45} 0 Q ${-w * 0.2} ${len * 0.4} 0 ${len * 0.62} Q ${w * 0.2} ${len * 0.4} ${w * 0.45} 0 Z`}
        fill="#fff3c4"
        opacity={opacity}
      />
    </g>
  );
}

function IonBeam({ throttle, sputter, motionOk, big }: { throttle: number; sputter: boolean; motionOk: boolean; big: boolean }) {
  if (throttle <= 0.02) return null;
  const t = Math.max(0.15, Math.min(1, throttle));
  const len = (big ? 34 : 26) * t;
  const cls = motionOk && !sputter ? "ion-hum" : motionOk && sputter ? "flame-sputter" : undefined;
  return (
    <g className={cls} style={{ transformOrigin: "0px 0px", transformBox: "fill-box" }}>
      <ellipse cx="0" cy={len * 0.45} rx={5 + (big ? 1.5 : 0)} ry={len * 0.55} fill={ION_BLUE} opacity={0.3} />
      <ellipse cx="0" cy={len * 0.3} rx={2.6 + (big ? 1 : 0)} ry={len * 0.34} fill={ION_BLUE} opacity={0.5} />
      <rect x={-1} y={0} width={2} height={len} fill={ION_BLUE} opacity={0.75} />
      <circle cx="0" cy="2" r="2.2" fill="#bff4ff" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Engines — bell + gimbal mount + actuators, hanging from the engine bay
// ---------------------------------------------------------------------------

function EnginePart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const { motionOk, engineOn, throttle, sputter, damaged } = state;
  const heat = damaged ? "#6b3a2a" : NOZZLE;

  if (part.variant === "ion" || part.variant === "monoprop") {
    const big = part.equipmentId === "advanced_ion_engine";
    if (part.variant === "monoprop") {
      return (
        <g>
          <rect x="-13" y="-14" width="26" height="11" rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
          {/* Mount struts up to the bay plate */}
          <line x1="-9" y1="-14" x2="-9" y2="-19" stroke={HULL_DARK} strokeWidth="2" />
          <line x1="9" y1="-14" x2="9" y2="-19" stroke={HULL_DARK} strokeWidth="2" />
          {[-9, -3, 3, 9].map((cx) => (
            <g key={cx}>
              <rect x={cx - 2} y="-3" width="4" height="6" fill={heat} />
              {engineOn ? (
                <ellipse
                  cx={cx}
                  cy={6}
                  rx="2.4"
                  ry={5 * Math.max(0.2, throttle)}
                  fill={ION_BLUE}
                  opacity="0.5"
                  className={motionOk && sputter ? "flame-sputter" : undefined}
                  style={{ transformOrigin: `${cx}px -3px`, transformBox: "fill-box" }}
                />
              ) : null}
            </g>
          ))}
        </g>
      );
    }
    return (
      <g>
        <rect x={big ? -10 : -9} y="-18" width={big ? 20 : 18} height="15" rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
        {/* Gimbal actuators */}
        <line x1={big ? -10 : -9} y1="-16" x2={big ? -14 : -13} y2="-11" stroke={HULL_DARK} strokeWidth="1.6" strokeLinecap="round" />
        <line x1={big ? 10 : 9} y1="-16" x2={big ? 14 : 13} y2="-11" stroke={HULL_DARK} strokeWidth="1.6" strokeLinecap="round" />
        <rect x={big ? -12 : -11} y="-3" width={big ? 24 : 22} height="7" rx="1.5" fill={heat} stroke={NOZZLE_INNER} strokeWidth="1" />
        {engineOn ? <IonBeam throttle={throttle} sputter={sputter} motionOk={motionOk} big={big} /> : null}
      </g>
    );
  }

  const wide = part.variant === "heavy" || part.variant === "nuclear";
  const long = part.variant === "vacuum";
  const w = wide ? 16 : long ? 12 : 11;
  const bellTop = -14;
  const bellBottom = wide ? 14 : long ? 18 : 15;
  return (
    <g>
      {/* Gimbal mount */}
      <rect x="-6" y={bellTop - 7} width="12" height="8" rx="1.5" fill={HULL_DARK} />
      {/* Gimbal actuators (steering struts) */}
      <line x1="-6" y1={bellTop - 5.5} x2="-10.5" y2={bellTop - 0.5} stroke={HULL_MID} strokeWidth="1.7" strokeLinecap="round" />
      <line x1="6" y1={bellTop - 5.5} x2="10.5" y2={bellTop - 0.5} stroke={HULL_MID} strokeWidth="1.7" strokeLinecap="round" />
      {/* Bell */}
      <path
        d={`M ${-w * 0.45} ${bellTop} L ${-w} ${bellBottom} L ${w} ${bellBottom} L ${w * 0.45} ${bellTop} Z`}
        fill={heat}
        stroke={NOZZLE_INNER}
        strokeWidth="1.2"
      />
      <path d={`M ${-w * 0.45} ${bellTop} L ${-w * 0.7} ${bellTop + 14} L ${w * 0.7} ${bellTop + 14} L ${w * 0.45} ${bellTop} Z`} fill={NOZZLE_INNER} />
      {/* Regenerative cooling tubes following the bell contour */}
      <path
        d={`M ${-w * 0.62} ${bellTop + 2} L ${-w * 0.8} ${bellBottom - 3}`}
        stroke={HULL_MID}
        strokeWidth="0.7"
        opacity="0.65"
        fill="none"
      />
      <path d={`M ${w * 0.62} ${bellTop + 2} L ${w * 0.8} ${bellBottom - 3}`} stroke={HULL_MID} strokeWidth="0.7" opacity="0.65" fill="none" />
      {wide ? (
        <>
          <rect x={-w} y={bellBottom - 10} width={2 * w} height="3" fill="#ffb020" opacity="0.55" />
          <rect x={-w} y={bellBottom - 4} width={2 * w} height="2" fill="#ffb020" opacity="0.35" />
        </>
      ) : null}
      {damaged ? (
        <>
          <path d={`M ${-w * 0.6} ${bellTop + 6} L ${-w * 0.1} ${bellBottom - 2}`} stroke="#1c1f26" strokeWidth="2" opacity="0.8" />
          <circle cx={w * 0.5} cy={bellTop + 8} r="1.8" fill="#ff4d6a" className={motionOk ? "event-pulse" : undefined} />
        </>
      ) : null}
      {/* Nozzle exit + flame */}
      <ellipse cx="0" cy={bellBottom} rx={w * 0.86} ry="3" fill="#0a0d12" />
      {engineOn ? (
        <g transform={`translate(0 ${bellBottom - 1})`}>
          <EngineFlame throttle={throttle} sputter={sputter} motionOk={motionOk} wide={wide} />
        </g>
      ) : (
        <ellipse cx="0" cy={bellBottom - 1} rx={w * 0.5} ry="1.8" fill={damaged ? "#ff4d6a" : THRUST_GLOW} opacity={damaged ? 0.8 : 0.5} />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Engine bay — boat-tail thrust structure the engine cluster hangs from
// ---------------------------------------------------------------------------

function EngineBayPart({ part }: { part: SpacecraftPart }) {
  const w = part.w / 2;
  const neck = (part.neckW ?? 16) / 2;
  return (
    <g>
      {/* Boat-tail flare: narrow at the interstage, wide at the thrust plate */}
      <path
        d={`M ${-neck} -7 L ${-w} 6 L ${w} 6 L ${neck} -7 Z`}
        fill="url(#scBusGrad)"
        stroke={HULL_DARK}
        strokeWidth="1.4"
      />
      {/* Panel seams along the flare */}
      <line x1={-neck * 0.45} y1={-4} x2={-w * 0.62} y2={4} stroke={HULL_DARK} strokeWidth="0.7" opacity="0.6" />
      <line x1={neck * 0.45} y1={-4} x2={w * 0.62} y2={4} stroke={HULL_DARK} strokeWidth="0.7" opacity="0.6" />
      {/* Thrust plate lip */}
      <rect x={-w} y={5} width={2 * w} height={3.4} rx={1.2} fill={HULL_DARK} stroke={NOZZLE_INNER} strokeWidth="0.6" />
      {/* Mount bolts along the plate */}
      {[-w + 3.5, -w / 2, 0, w / 2, w - 3.5].map((bx) => (
        <circle key={bx} cx={bx} cy={6.7} r={Math.min(1.4, w * 0.06)} fill={HULL_MID} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Adapter — conic frustum joining the tank stack (or bay) to the wider bus
// ---------------------------------------------------------------------------

function AdapterPart({ part }: { part: SpacecraftPart }) {
  const isInterstage = part.flags.includes("interstage");
  const halfH = part.h / 2; // works with any adapter height (bus=10, interstage=6)
  const topR = part.w / 2;
  // Bus adapters get a +1.5 visual overlap on the neck (snugs over the tank
  // rim). Interstage adapters use exact widths so the join between two tanks
  // is flush — no visible seam or gap.
  const bottomR = isInterstage
    ? Math.max((part.neckW ?? part.w) / 2, 4)
    : Math.max((part.neckW ?? 20) / 2 + 1.5, 7);
  const wideAtTop = topR >= bottomR;
  const wideR = Math.max(topR, bottomR);
  const bandY = wideAtTop ? -halfH * 0.4 : halfH * 0.4;
  const boltY = wideAtTop ? -halfH * 0.7 : halfH * 0.7;
  return (
    <g>
      {/* Frustum: top edge (2×topR) tapering to bottom edge (2×bottomR).
          When topR > bottomR the frustum narrows downward (bus adapter);
          when topR < bottomR it widens downward (interstage: narrow tank
          below, wide tank above). */}
      <path d={`M ${-topR} ${-halfH} L ${-bottomR} ${halfH} L ${bottomR} ${halfH} L ${topR} ${-halfH} Z`} fill="url(#scBusGrad)" stroke={HULL_DARK} strokeWidth="1.3" />
      {/* Horizontal joint band on the WIDE edge */}
      <line x1={-wideR * 0.82} y1={bandY} x2={wideR * 0.82} y2={bandY} stroke={HULL_DARK} strokeWidth="0.8" opacity="0.65" />
      {/* Panel seams (top edge → bottom edge) */}
      <line x1={-topR * 0.45} y1={-halfH * 0.8} x2={-bottomR * 0.5} y2={halfH * 0.8} stroke={HULL_DARK} strokeWidth="0.6" opacity="0.5" />
      <line x1={topR * 0.45} y1={-halfH * 0.8} x2={bottomR * 0.5} y2={halfH * 0.8} stroke={HULL_DARK} strokeWidth="0.6" opacity="0.5" />
      {/* Attachment bolts on the WIDE edge (direction-aware) */}
      {[-wideR + 3, -wideR / 2, 0, wideR / 2, wideR - 3].map((bx) => (
        <circle key={bx} cx={bx} cy={boltY} r="1.1" fill={HULL_MID} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tanks — domed cylinder sections with weld rings, stacked above the engine
// ---------------------------------------------------------------------------

function TankPart({ part }: { part: SpacecraftPart }) {
  const r = part.w / 2;
  const h = part.h;
  const xenon = part.variant === "xenon";
  const drop = part.variant === "drop";
  const gradId = xenon ? "scTankXenon" : drop ? "scTankDrop" : "scTankGold";
  const stroke = xenon ? "#48597a" : drop ? "#8296ad" : GOLD_DARK;
  const ring = xenon ? "#6a7f9f" : drop ? "#a9bccd" : "#b08a3e";
  const domeLight = xenon ? "#a8bcd9" : drop ? "#e8f0f7" : "#ecc572";
  return (
    <g>
      {/* Cylinder body with curvature shading */}
      <rect x={-r} y={-h / 2 + 2.5} width={2 * r} height={h - 5} fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1.4" />
      {/* Domed caps */}
      <ellipse cx="0" cy={-h / 2 + 2.5} rx={r} ry={2.8} fill={domeLight} stroke={stroke} strokeWidth="1.1" />
      <ellipse cx="0" cy={h / 2 - 2.5} rx={r} ry={2.8} fill={ring} stroke={stroke} strokeWidth="1.1" opacity="0.95" />
      {/* Weld rings — every section reads as a bolted-together body joint */}
      <rect x={-r - 1.5} y={-h / 2 + 0.8} width={2 * r + 3} height={2.6} rx="1.2" fill={ring} stroke={stroke} strokeWidth="0.7" />
      <rect x={-r - 1.5} y={h / 2 - 3.4} width={2 * r + 3} height={2.6} rx="1.2" fill={ring} stroke={stroke} strokeWidth="0.7" />
      {/* Foil crinkle lines */}
      <line x1={-r + 3} y1={-h / 2 + 6} x2={-r + 3} y2={h / 2 - 6} stroke={stroke} strokeWidth="0.6" opacity="0.5" />
      <line x1={r - 4} y1={-h / 2 + 7} x2={r - 4} y2={h / 2 - 7} stroke={stroke} strokeWidth="0.6" opacity="0.4" />
      {/* Specular highlight strip (cylinder sheen) */}
      <rect x={-r * 0.52} y={-h / 2 + 6} width={r * 0.22} height={h - 12} rx={1} fill="#ffffff" opacity={drop ? 0.4 : 0.16} />
      {part.flags.includes("bottom") ? (
        <>
          {/* Interstage skirt down to the engine cluster — keeps the stack
              reading as ONE connected vehicle */}
          <path
            d={`M ${-r * 0.86} ${h / 2} L ${-(part.neckW ?? 9) / 2} ${h / 2 + 9} L ${(part.neckW ?? 9) / 2} ${h / 2 + 9} L ${r * 0.86} ${h / 2} Z`}
            fill="#5f7794"
            stroke="#31435c"
            strokeWidth="1.1"
          />
          <line x1={-(part.neckW ?? 9) / 2} y1={h / 2 + 4} x2={(part.neckW ?? 9) / 2} y2={h / 2 + 4} stroke="#31435c" strokeWidth="0.8" opacity="0.6" />
        </>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Bus — the structural core
// ---------------------------------------------------------------------------

function BusPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const w = part.w;
  const h = part.h;
  const { damaged, motionOk } = state;
  const blanket = part.flags.includes("blanket");
  const whipple = part.flags.includes("whipple");
  const rails = part.flags.includes("rails");
  return (
    <g>
      {/* Radiation-safe interior: main hull */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="9" fill="url(#scBusGrad)" stroke={HULL_DARK} strokeWidth="1.6" />
      {/* Structural end rings (top + bottom frames) */}
      <rect x={-w / 2 - 1} y={-h / 2 + 1} width={w + 2} height={3} rx="1.5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.7" />
      <rect x={-w / 2 - 1} y={h / 2 - 4} width={w + 2} height={3} rx="1.5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.7" />
      {[-w / 2 + 6, -w / 2 + 12, w / 2 - 12, w / 2 - 6].map((bx) => (
        <circle key={bx} cx={bx} cy={-h / 2 + 2.5} r="0.9" fill={HULL_DARK} opacity="0.8" />
      ))}
      {/* Panel lines */}
      <line x1={-w / 2 + 9} y1={-h / 2} x2={-w / 2 + 9} y2={h / 2} stroke={HULL_DARK} strokeWidth="0.7" opacity="0.6" />
      <line x1={w / 2 - 9} y1={-h / 2} x2={w / 2 - 9} y2={h / 2} stroke={HULL_DARK} strokeWidth="0.7" opacity="0.6" />
      <line x1={-w / 2} y1={-h * 0.18} x2={w / 2} y2={-h * 0.18} stroke={HULL_DARK} strokeWidth="0.8" opacity="0.7" />
      <line x1={-w / 2} y1={h * 0.22} x2={w / 2} y2={h * 0.22} stroke={HULL_DARK} strokeWidth="0.8" opacity="0.7" />

      {/* Gold MLI blanket tint */}
      {blanket ? <rect x={-w / 2 + 3} y={-h / 2 + 6} width={w - 6} height={h - 12} rx="6" fill={GOLD} opacity="0.24" /> : null}

      {/* Equipment bay */}
      <rect x={-13} y={-h * 0.34} width="26" height="17" rx="3" fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.8" />
      <circle
        cx="0"
        cy={-h * 0.34 + 8.5}
        r="3"
        fill={damaged ? "#ff4d6a" : "#2dd4a7"}
        opacity="0.95"
        className={damaged && motionOk ? "event-pulse" : undefined}
      />
      <rect x={-9} y={h * 0.06} width="18" height="7" rx="2" fill={HULL_DARK} />
      <rect x={-9} y={h * 0.06 + 9} width="18" height="3.6" rx="1" fill={HULL_DARK} opacity="0.7" />

      {/* Whipple armour plates (micrometeorite protection) */}
      {whipple ? (
        <>
          <rect x={-w / 2 - 4} y={-h / 2 + 7} width={5} height={h - 14} rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.6" />
          <rect x={w / 2 - 1} y={-h / 2 + 7} width={5} height={h - 14} rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.6" />
        </>
      ) : null}

      {/* Modular mounting rails */}
      {rails ? (
        <>
          <line x1={-w / 2 - 2} y1={-h * 0.42} x2={-w / 2 - 2} y2={h * 0.42} stroke={PANEL_EDGE} strokeWidth="1.6" opacity="0.5" />
          <line x1={w / 2 + 2} y1={-h * 0.42} x2={w / 2 + 2} y2={h * 0.42} stroke={PANEL_EDGE} strokeWidth="1.6" opacity="0.5" />
        </>
      ) : null}

      {/* Star tracker windows */}
      <circle cx={-w / 2 + 6} cy={-h / 2 + 8} r="2.5" fill="#0d2340" stroke={PANEL_EDGE} strokeWidth="0.7" />
      <circle cx={w / 2 - 6} cy={-h / 2 + 8} r="2.5" fill="#0d2340" stroke={PANEL_EDGE} strokeWidth="0.7" />

      {/* Damage scorch */}
      {damaged ? (
        <>
          <path d={`M ${-w * 0.3} ${-h * 0.1} q 6 -5 12 2 q -4 6 -12 -2`} fill="#1c1f26" opacity="0.7" />
          <path d={`M ${w * 0.12} ${h * 0.16} q 5 -4 9 1 q -3 5 -9 -1`} fill="#1c1f26" opacity="0.6" />
          <circle cx={-w * 0.36} cy={-h * 0.08} r="1.8" fill="#ff4d6a" className={motionOk ? "event-pulse" : undefined} />
        </>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Solar wings — hinged mounting arm + panels that unfold as deploy goes 0 → 1
// ---------------------------------------------------------------------------

function WingPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const dir = part.side === "l" ? -1 : 1;
  const len = part.w;
  const h = part.h;
  const cellsX = part.variant === "large" ? 5 : 4;
  const { deploy, damaged, motionOk } = state;
  const d = Math.max(0.05, Math.min(1, deploy));
  // Folded: panel collapsed onto the yoke and tilted up; deployed: flat out.
  const scaleX = 0.12 + 0.88 * d;
  const rotate = (1 - d) * 74;
  const so = part.standoff ?? 4;
  return (
    <g>
      {/* Hull mounting base (drawn mirrored per side) */}
      <g transform={dir < 0 ? "scale(-1,1)" : undefined}>
        {/* Base plate bolted to the hull wall */}
        <rect x={-so - 2.5} y={-4.5} width={5} height={9} rx={1} fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.6" />
        {/* Boom from the base out to the hinge */}
        <rect x={-so + 2.5} y={-1.6} width={so + 1.5} height={3.2} rx={1.2} fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.5" />
      </g>
      {/* Hinge knuckle */}
      <circle cx={0} cy="0" r="2.4" fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.8" />
      <g
        transform={`translate(${dir * 6} 0) rotate(${dir * rotate}) scale(${scaleX}, 1)`}
        style={
          motionOk
            ? { transition: "transform 1.7s cubic-bezier(0.22, 0.85, 0.3, 1)", transformBox: "fill-box", transformOrigin: dir > 0 ? "left center" : "right center" }
            : undefined
        }
      >
        <rect
          x={dir > 0 ? 0 : -len}
          y={-h / 2}
          width={len}
          height={h}
          rx="2"
          fill="#12325e"
          stroke={damaged ? "#ff4d6a" : PANEL_EDGE}
          strokeWidth="1.3"
          className={damaged && motionOk ? "wing-flicker" : undefined}
        />
        {Array.from({ length: cellsX }).map((_, i) =>
          Array.from({ length: 2 }).map((_, j) => (
            <rect
              key={`${i}-${j}`}
              x={(dir > 0 ? 2.5 : -len + 2.5) + i * ((len - 5) / cellsX)}
              y={-h / 2 + 2.5 + (j * (h - 5)) / 2}
              width={(len - 5) / cellsX - 1.6}
              height={(h - 5) / 2 - 1.6}
              fill={damaged ? "#0b1524" : "#1f5fa8"}
              opacity={0.92}
            />
          ))
        )}
        <rect
          x={dir > 0 ? 2 : -len + 2}
          y={-h / 2 + 2}
          width={len - 4}
          height={(h - 4) / 2.4}
          fill={damaged ? "#132236" : "#9ed8ff"}
          opacity={damaged ? 0.25 : 0.14}
        />
        {damaged ? <path d={`M ${len * 0.2} ${-h / 2} L ${len * 0.4} ${h / 2}`} stroke="#ff4d6a" strokeWidth="1.6" opacity="0.9" /> : null}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Antennas — PRESERVED (visual appearance, positioning and animation)
// ---------------------------------------------------------------------------

function AntennaPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const { motionOk, commFail, damaged, deploy } = state;
  const d = Math.max(0.08, Math.min(1, deploy));
  const rise = { transform: `translateY(${(1 - d) * 16}px) scaleY(${0.35 + 0.65 * d})`, transformOrigin: "center bottom", transformBox: "fill-box" as const };
  const style = motionOk ? { ...rise, transition: "transform 1.5s cubic-bezier(0.3, 0.9, 0.35, 1)" } : rise;
  const status = commFail || damaged ? "#ff4d6a" : "#2dd4a7";

  let art: React.ReactNode;
  switch (part.variant) {
    case "low_gain_antenna":
      art = (
        <g>
          <line x1="0" y1="6" x2="0" y2="-18" stroke={HULL_MID} strokeWidth="2" />
          <circle cx="0" cy="-20" r="3.2" fill={HULL_LIGHT} stroke={HULL_DARK} strokeWidth="1" />
        </g>
      );
      break;
    case "optical_terminal":
      art = (
        <g>
          <rect x="-7" y="-2" width="14" height="11" rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
          <circle cx="0" cy="-5" r="4.6" fill="#0d2340" stroke={commFail ? "#ff4d6a" : ION_BLUE} strokeWidth="1.3" />
          <circle cx="0" cy="-5" r="1.6" fill={commFail ? "#ff4d6a" : ION_BLUE} />
        </g>
      );
      break;
    case "relay_transponder":
      art = (
        <g>
          <rect x="-9" y="-4" width="18" height="12" rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
          <line x1="0" y1="-4" x2="0" y2="-12" stroke={HULL_MID} strokeWidth="2" />
          <ellipse cx="0" cy="-14" rx="7" ry="3.4" fill="#d7e6f6" stroke={HULL_DARK} strokeWidth="1" />
          <circle cx="6" cy="2" r="1.6" fill={status} className={commFail && motionOk ? "event-pulse" : undefined} />
        </g>
      );
      break;
    default: {
      // Dishes: communication_antenna + deep_space_antenna
      const big = part.variant === "deep_space_antenna";
      const r = big ? 16 : 11;
      art = (
        <g className={motionOk && !commFail ? "dish-track" : undefined} style={{ transformOrigin: "0px 0px", transformBox: "fill-box" }}>
          <line x1="0" y1={r * 0.8} x2="0" y2={-r * 0.2} stroke={HULL_MID} strokeWidth="3" />
          <ellipse cx="0" cy="0" rx={r} ry={r * 0.5} fill="#d7e6f6" stroke={commFail ? "#ff4d6a" : HULL_DARK} strokeWidth="1.4" />
          <ellipse cx="0" cy="0" rx={r * 0.62} ry={r * 0.3} fill="#b7cde6" opacity="0.8" />
          <ellipse cx="0" cy="0" rx={r * 0.25} ry={r * 0.11} fill={HULL_DARK} />
          <line x1="0" y1="0" x2="0" y2={-r * 0.85} stroke={HULL_DARK} strokeWidth="1.6" />
          <circle cx="0" cy={-r * 0.95} r="2.2" fill={commFail ? "#ff4d6a" : PANEL_EDGE} />
        </g>
      );
      break;
    }
  }

  return (
    <g style={style}>
      {art}
      {/* Status LED */}
      <circle cx="0" cy="8" r="1.7" fill={status} className={commFail && motionOk ? "blink" : undefined} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Science instruments — bracket-mounted sensor pods
// ---------------------------------------------------------------------------

function InstrumentPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const { motionOk, damaged } = state;
  const flick = damaged && motionOk ? "event-pulse" : undefined;
  const bracket = <MountBracket part={part} />;
  switch (part.variant) {
    case "spectrometer":
      return (
        <g>
          {bracket}
          <rect x="-8" y="-7" width="16" height="14" rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
          <circle cx="0" cy="0" r="3.5" fill="#0d2340" stroke={damaged ? "#ff4d6a" : PANEL_EDGE} strokeWidth="1.2" />
          <rect x="-8" y="7" width="16" height="3" fill={HULL_DARK} />
        </g>
      );
    case "radar_sounder":
      return (
        <g>
          {bracket}
          <rect x="-11" y="-3" width="22" height="7" rx="1.5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={-9 + i * 4.2} y="-7" width="2.6" height="4" fill="#0d2340" stroke={PANEL_EDGE} strokeWidth="0.5" />
          ))}
        </g>
      );
    case "magnetometer":
      return (
        <g>
          <MountBracket part={part} armY={9} />
          <line x1="0" y1="9" x2="0" y2="-20" stroke={HULL_MID} strokeWidth="2" />
          <circle cx="0" cy="-22" r="2.8" fill={damaged ? "#ff4d6a" : ION_BLUE} stroke={HULL_DARK} strokeWidth="0.8" />
          <circle cx="0" cy="-14" r="1.9" fill={HULL_LIGHT} />
        </g>
      );
    case "dust_analyzer":
      return (
        <g>
          {bracket}
          <rect x="-6" y="-6" width="12" height="12" rx="2" fill={HULL_DARK} stroke={HULL_MID} strokeWidth="1" />
          <circle cx="0" cy="0" r="2.5" fill="#ffd27a" className={flick} />
          <path d="M -4 3 L 0 0 L 4 3" stroke="#ffd27a" strokeWidth="0.8" fill="none" />
        </g>
      );
    case "sample_arm":
      return (
        <g>
          {bracket}
          <rect x="-4" y="-4" width="8" height="8" rx="1" fill={HULL_MID} />
          <path d="M 0 0 L 10 6 L 15 15" stroke={damaged ? "#ff4d6a" : HULL_LIGHT} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="15" cy="15" r="3" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1" />
        </g>
      );
    default:
      return (
        <g>
          {bracket}
          <rect x="-6" y="-6" width="12" height="12" rx="2" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1" />
          <circle cx="0" cy="0" r="3" fill="#0d2340" stroke={damaged ? "#ff4d6a" : "#7fe3ff"} strokeWidth="1.2" />
          <circle cx="0" cy="0" r="1.1" fill="#7fe3ff" />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Navigation sensors
// ---------------------------------------------------------------------------

function NavPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const { damaged } = state;
  switch (part.variant) {
    case "star_tracker":
      return (
        <g>
          <rect x="-5" y="-4" width="10" height="8" rx="1.5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.9" />
          <circle cx="0" cy="0" r="2.6" fill="#0d2340" stroke={damaged ? "#ff4d6a" : PANEL_EDGE} strokeWidth="1" />
          <circle cx="0" cy="0" r="0.9" fill="#d6ecff" />
        </g>
      );
    case "terrain_nav":
      return (
        <g>
          <rect x="-6" y="-5" width="12" height="6" rx="1.5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.9" />
          <path d="M -4 1 L 0 8 L 4 1 Z" fill="#0d2340" stroke={damaged ? "#ff4d6a" : PANEL_EDGE} strokeWidth="1" />
        </g>
      );
    case "ds_transponder":
      return (
        <g>
          <rect x="-6" y="-4" width="12" height="9" rx="1.5" fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.9" />
          <circle cx="0" cy="-1" r="2.2" fill={ION_BLUE} opacity="0.85" />
          <rect x="-4" y="2" width="8" height="1.6" fill={PANEL_EDGE} opacity="0.6" />
        </g>
      );
    default: // nav_computer
      return (
        <g>
          <rect x="-7" y="-5" width="14" height="10" rx="1.5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="0.9" />
          <circle cx="-3" cy="0" r="1.3" fill="#2dd4a7" className={state.motionOk ? "live-dot" : undefined} />
          <circle cx="0.5" cy="0" r="1.3" fill={PANEL_EDGE} opacity="0.8" />
          <circle cx="4" cy="0" r="1.3" fill="#2dd4a7" opacity="0.5" />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Power pods — RTG / batteries / fuel cells on visible brackets
// ---------------------------------------------------------------------------

function PodPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const { motionOk, damaged } = state;
  const bracket = <MountBracket part={part} />;
  if (part.variant === "rtg" || part.variant === "rtg_advanced") {
    const adv = part.variant === "rtg_advanced";
    return (
      <g>
        {bracket}
        <rect x="-6" y="-12" width="12" height="24" rx="5" fill={HULL_MID} stroke={HULL_DARK} strokeWidth="1.1" />
        {[-8, -3, 2, 7].map((y) => (
          <line key={y} x1="-8" y1={y} x2="8" y2={y} stroke={HULL_DARK} strokeWidth="1.6" strokeLinecap="round" />
        ))}
        <circle cx="0" cy="0" r="2.4" fill="#ffb020" opacity={adv ? 0.95 : 0.7} className={motionOk ? "rtg-glow" : undefined} />
        {adv ? <circle cx="0" cy="0" r="5" fill="#ffb020" opacity="0.2" /> : null}
        {damaged ? <circle cx="0" cy="0" r="2" fill="#ff4d6a" className={motionOk ? "event-pulse" : undefined} /> : null}
      </g>
    );
  }
  if (part.variant === "fuel_cell") {
    return (
      <g>
        {bracket}
        <rect x="-6" y="-8" width="12" height="16" rx="3" fill="#48597a" stroke={HULL_DARK} strokeWidth="1" />
        <rect x="-4" y="-5" width="8" height="3" fill={PANEL_EDGE} opacity="0.7" />
        <rect x="-4" y="0" width="8" height="3" fill="#2dd4a7" opacity="0.6" />
        <rect x="-4" y="5" width="8" height="3" fill={PANEL_EDGE} opacity="0.5" />
      </g>
    );
  }
  // Batteries
  const big = part.variant === "battery_large";
  const cells = big ? 4 : 3;
  return (
    <g>
      {bracket}
      <rect x="-6.5" y={big ? -9 : -7} width="13" height={big ? 18 : 14} rx="2" fill={HULL_DARK} stroke={HULL_MID} strokeWidth="1" />
      {Array.from({ length: cells }).map((_, i) => (
        <rect
          key={i}
          x="-4.5"
          y={(big ? -7 : -5) + i * (big ? 4.2 : 4.4)}
          width="9"
          height="2.6"
          rx="0.6"
          fill={damaged ? "#ff4d6a" : "#2dd4a7"}
          opacity={damaged ? 0.8 : 0.5 + (i === cells - 1 ? 0.35 : 0.15)}
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Thermal / protection / landing
// ---------------------------------------------------------------------------

function RadiatorPart({ part }: { part: SpacecraftPart }) {
  const dir = part.side === "l" ? -1 : 1;
  const h = part.h;
  return (
    <g>
      {/* Coolant lines + hinge clamp back to the hull */}
      <MountBracket part={part} />
      <path
        d={`M ${-dir * (part.w / 2 + 3)} ${-h * 0.28} L ${-dir * part.w / 2} ${-h * 0.28}`}
        stroke="#c1553b"
        strokeWidth="1"
        opacity="0.8"
        fill="none"
      />
      <path
        d={`M ${-dir * (part.w / 2 + 3)} ${h * 0.28} L ${-dir * part.w / 2} ${h * 0.28}`}
        stroke="#c1553b"
        strokeWidth="1"
        opacity="0.8"
        fill="none"
      />
      {/* Radiator fin panel */}
      <rect x={-part.w / 2} y={-h / 2} width={part.w} height={h} rx="1.5" fill="#3a2a33" stroke={HULL_DARK} strokeWidth="1" />
      {[-h / 2 + 4, -h / 2 + 9, -h / 2 + 14, -h / 2 + 19, -h / 2 + 24].map((y) =>
        y < h / 2 - 2 ? (
          <line key={y} x1={-part.w / 2 + 1} y1={y} x2={part.w / 2 - 1} y2={y} stroke="#c1553b" strokeWidth="1.1" opacity="0.75" />
        ) : null
      )}
    </g>
  );
}

/**
 * Heat shield — physically integrated into the base of the spacecraft:
 * a mounting collar at the engine-mount plane (the engine bells recess into
 * it), a shallow ablative dish below, and support struts rising to the
 * engine-bay boat-tail. Never a free-floating object.
 */
function ShieldPart({ part }: { part: SpacecraftPart }) {
  const collarW = part.collarW ?? 40;
  const collarX = collarW / 2;
  const rimX = part.w / 2;
  const topY = -part.h / 2; // collar top (model: rise above the mount plane)
  const collarBottom = topY + 5; // where the dish rim starts
  const bottomY = part.h / 2; // dish centre depth
  const reinforced = part.variant === "reinforced_heat_shield" || part.variant === "thermal_protection_system";
  const tps = part.variant === "thermal_protection_system";
  const strutTopLocal = part.strutTop !== undefined ? part.y - part.strutTop : null;
  const strutX = part.strutX ?? Math.max(12, collarX * 0.72);

  return (
    <g>
      {/* Support struts rising to the engine bay (behind the engine bells) */}
      {strutTopLocal !== null ? (
        <>
          {[-1, 1].map((s) => (
            <g key={s}>
              <rect
                x={s * strutX - 1.4}
                y={strutTopLocal}
                width={2.8}
                height={topY - strutTopLocal}
                fill={HULL_MID}
                stroke={HULL_DARK}
                strokeWidth="0.6"
              />
              {/* Attachment foot at the engine-bay flare */}
              <rect x={s * strutX - 3} y={strutTopLocal - 2.5} width={6} height={3} rx={1} fill={HULL_DARK} />
            </g>
          ))}
        </>
      ) : null}

      {/* Mounting collar — bolts to the engine bay / base section */}
      <rect x={-collarX} y={topY} width={collarW} height={5.5} rx={1.5} fill={HULL_DARK} stroke={NOZZLE_INNER} strokeWidth="0.8" />
      {[-collarX + 4, -collarX / 2, 0, collarX / 2, collarX - 4].map((bx) => (
        <circle key={bx} cx={bx} cy={topY + 1.4} r="0.9" fill={HULL_MID} />
      ))}

      {/* Ablative dish */}
      <path
        d={`M ${-rimX} ${collarBottom} Q ${-rimX * 0.94} ${bottomY * 0.55} ${-rimX * 0.42} ${bottomY * 0.8} Q ${-rimX * 0.18} ${bottomY} 0 ${bottomY} Q ${rimX * 0.18} ${bottomY} ${rimX * 0.42} ${bottomY * 0.8} Q ${rimX * 0.94} ${bottomY * 0.55} ${rimX} ${collarBottom} Z`}
        fill={tps ? "#3a3f4d" : reinforced ? "#2f333d" : "#54463a"}
        stroke="#232830"
        strokeWidth="1.5"
      />
      {/* Variant surface treatment */}
      {tps ? (
        // Ceramic tile grid
        Array.from({ length: 5 }).map((_, i) =>
          Array.from({ length: 3 }).map((_, j) => (
            <rect
              key={`t${i}-${j}`}
              x={-rimX * 0.72 + i * (rimX * 1.44) / 5 + 0.8}
              y={collarBottom + 2 + j * ((bottomY - collarBottom - 3) / 3)}
              width={(rimX * 1.44) / 5 - 1.6}
              height={(bottomY - collarBottom - 3) / 3 - 1.2}
              fill="none"
              stroke="#232830"
              strokeWidth="0.6"
              opacity="0.7"
            />
          ))
        )
      ) : (
        // Radial ablative ribs converging on the hub
        [-0.78, -0.45, -0.16, 0.16, 0.45, 0.78].map((f) => (
          <line
            key={f}
            x1={rimX * f}
            y1={collarBottom + 1}
            x2={rimX * f * 0.32}
            y2={bottomY - 1.5}
            stroke="#232830"
            strokeWidth="1"
            opacity="0.7"
          />
        ))
      )}
      {/* Rim + hub hardware */}
      <ellipse cx="0" cy={collarBottom} rx={rimX} ry="3" fill={reinforced ? "#494f5c" : "#6b5a4a"} stroke="#232830" strokeWidth="1" />
      {reinforced ? <ellipse cx="0" cy={collarBottom} rx={rimX * 0.72} ry="2" fill="none" stroke="#232830" strokeWidth="0.8" opacity="0.7" /> : null}
      <ellipse cx="0" cy={bottomY - 2} rx={rimX * 0.2} ry="1.6" fill="#232830" opacity="0.85" />
    </g>
  );
}

/**
 * Radiation shielding — an armoured composite shell encapsulating the bus
 * section (panel seams, standoff bolts and a storm-shelter vault on the
 * advanced variant), replacing the old dashed "force field" outline.
 */
function AuraPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const w = part.w;
  const h = part.h;
  const strong = part.variant === "radiation_shield_advanced";
  const basic = part.variant === "radiation_shield_basic";
  const shell = basic ? "#4f4a66" : strong ? "#3d3753" : "#474159";
  const edge = "#241f33";
  return (
    <g>
      {/* Armoured shell encapsulating the section */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={11} fill={shell} stroke={edge} strokeWidth={basic ? 1.4 : 1.8} />
      {/* Layered-composite edge band (visible rim around the hull) */}
      <rect x={-w / 2 + 1.2} y={-h / 2 + 1.2} width={w - 2.4} height={h - 2.4} rx={9.5} fill="none" stroke="#6b6187" strokeWidth="0.9" opacity="0.55" />
      {/* Composite panel seams */}
      <line x1="0" y1={-h / 2 + 3.5} x2="0" y2={h / 2 - 3.5} stroke={edge} strokeWidth="0.8" opacity="0.7" />
      <line x1={-w / 2 + 4} y1={-h * 0.16} x2={w / 2 - 4} y2={-h * 0.16} stroke={edge} strokeWidth="0.8" opacity="0.6" />
      <line x1={-w / 2 + 4} y1={h * 0.18} x2={w / 2 - 4} y2={h * 0.18} stroke={edge} strokeWidth="0.8" opacity="0.6" />
      {/* Standoff bolts tying shell to hull */}
      {[
        [-w / 2 + 4.5, -h / 2 + 5.5],
        [w / 2 - 4.5, -h / 2 + 5.5],
        [-w / 2 + 4.5, h / 2 - 5.5],
        [w / 2 - 4.5, h / 2 - 5.5],
      ].map(([bx, by]) => (
        <circle key={`${bx}-${by}`} cx={bx} cy={by} r="1.2" fill={edge} opacity="0.95" />
      ))}
      {/* Protection accent seam (subtle, breathing) */}
      <rect
        x={-w / 2 + 2.4}
        y={-h / 2 + 2.4}
        width={w - 4.8}
        height={h - 4.8}
        rx={8.5}
        fill="none"
        stroke="#c084fc"
        strokeOpacity={strong ? 0.45 : 0.32}
        strokeWidth={1.2}
        className={state.motionOk ? "aura-breathe" : undefined}
        style={{ transformOrigin: "center", transformBox: "fill-box" }}
      />
      {/* Advanced variant: storm-shelter vault */}
      {strong ? (
        <>
          <rect x={-8} y={-6.5} width={16} height={13} rx="2" fill={edge} stroke="#c084fc" strokeOpacity="0.5" strokeWidth="0.8" />
          <line x1={-8} y1={-6.5} x2="8" y2="6.5" stroke="#c084fc" strokeOpacity="0.35" strokeWidth="0.8" />
          <line x1="8" y1={-6.5} x2={-8} y2="6.5" stroke="#c084fc" strokeOpacity="0.35" strokeWidth="0.8" />
        </>
      ) : null}
    </g>
  );
}

/** Dust protection — a metallic shroud clamped around the engine / base section. */
function SkirtPart({ part }: { part: SpacecraftPart }) {
  const w = part.w / 2;
  return (
    <g>
      {/* Shroud body around the engine section (brushed metallic, distinct
          from the ablative heat shield below it) */}
      <path d={`M ${-w} -10 L ${w} -10 L ${w * 0.86} 8 L ${-w * 0.86} 8 Z`} fill="#5d564d" stroke="#2e2a25" strokeWidth="1.2" />
      {/* Brushed-metal verticals */}
      {[-0.62, -0.28, 0.06, 0.4, 0.72].map((f) => (
        <line key={f} x1={w * f} y1={-8.5} x2={w * f * 0.9} y2={6.5} stroke="#2e2a25" strokeWidth="0.9" opacity="0.6" />
      ))}
      {/* Sheen strip */}
      <rect x={-w * 0.42} y={-8.5} width={w * 0.16} height={15} fill="#8d857a" opacity="0.5" />
      {/* Clamp ring bolted to the structure above */}
      <rect x={-w - 1.5} y={-12.5} width={2 * w + 3} height={3} rx={1.2} fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.6" />
      {[-w + 3, -w / 2, 0, w / 2, w - 3].map((bx) => (
        <circle key={bx} cx={bx} cy={-11} r="0.8" fill={HULL_MID} />
      ))}
    </g>
  );
}

function LegsPart({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  const heavy = part.variant === "heavy";
  const spread = heavy ? 40 : 32;
  const stroke = heavy ? 4 : 3;
  const airbag = part.flags.includes("airbag");
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          {/* Primary strut — root reaches up to the engine-bay thrust plate */}
          <line x1={s * 10} y1={-22} x2={s * spread} y2={26} stroke={HULL_MID} strokeWidth={stroke} strokeLinecap="round" />
          {/* Secondary brace */}
          <line x1={s * 12} y1={7} x2={s * (spread - 7)} y2={19} stroke={HULL_MID} strokeWidth={stroke * 0.6} />
          {/* Root fairing where the strut meets the thrust structure */}
          <path d={`M ${s * 7} -22 L ${s * 15} -22 L ${s * 13} -10 L ${s * 8} -10 Z`} fill={HULL_DARK} stroke={HULL_MID} strokeWidth="0.6" />
          <circle cx={s * 11} cy={-19} r="0.9" fill={HULL_MID} />
          {/* Footpad */}
          <rect x={s * spread - (s > 0 ? 0 : 9)} y="26" width="9" height="4" rx="1.5" fill={HULL_DARK} />
        </g>
      ))}
      {airbag ? (
        <g className={state.motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: "center", transformBox: "fill-box" }}>
          {[-16, 0, 16].map((x) => (
            <circle key={x} cx={x} cy={30} r="8" fill="#c9d6e4" stroke="#8296ad" strokeWidth="1.4" opacity="0.9" />
          ))}
        </g>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function SpacecraftPartView({ part, state }: { part: SpacecraftPart; state: PartRenderState }) {
  switch (part.kind) {
    case "engine":
      return <EnginePart part={part} state={state} />;
    case "engine_bay":
      return <EngineBayPart part={part} />;
    case "tank":
      return <TankPart part={part} />;
    case "adapter":
      return <AdapterPart part={part} />;
    case "bus":
      return <BusPart part={part} state={state} />;
    case "wing":
      return <WingPart part={part} state={state} />;
    case "antenna":
      return <AntennaPart part={part} state={state} />;
    case "instrument":
      return <InstrumentPart part={part} state={state} />;
    case "nav":
      return <NavPart part={part} state={state} />;
    case "pod":
      return <PodPart part={part} state={state} />;
    case "radiator":
      return <RadiatorPart part={part} />;
    case "shield":
      return <ShieldPart part={part} />;
    case "aura":
      return <AuraPart part={part} state={state} />;
    case "skirt":
      return <SkirtPart part={part} />;
    case "legs":
      return <LegsPart part={part} state={state} />;
    default:
      return null;
  }
}
