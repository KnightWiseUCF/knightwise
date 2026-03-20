interface FlairPresentation {
  emoji: string;
  className: string;
}

const DEFAULT_EMOJI = "✨";

const PALETTE = Object.freeze({
  gold: "bg-amber-100 border-amber-300 text-amber-900",
  pink: "bg-pink-100 border-pink-300 text-pink-900",
  slate: "bg-slate-100 border-slate-300 text-slate-900",
  stone: "bg-stone-100 border-stone-300 text-stone-900",
  violet: "bg-violet-100 border-violet-300 text-violet-900",
  lime: "bg-lime-100 border-lime-300 text-lime-900",
  red: "bg-red-100 border-red-300 text-red-900",
  orange: "bg-orange-100 border-orange-300 text-orange-900",
  teal: "bg-teal-100 border-teal-300 text-teal-900",
  sky: "bg-sky-100 border-sky-300 text-sky-900",
  emerald: "bg-emerald-100 border-emerald-300 text-emerald-900",
  indigo: "bg-indigo-100 border-indigo-300 text-indigo-900",
  fuchsia: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900",
  rose: "bg-rose-100 border-rose-300 text-rose-900",
});

const FALLBACK_STYLES = [
  PALETTE.rose,
  PALETTE.sky,
  PALETTE.emerald,
  PALETTE.gold,
  PALETTE.indigo,
  PALETTE.fuchsia,
];

const EXACT_STYLES = new Map<string, FlairPresentation>([
  ["pawn", { emoji: "♟️", className: PALETTE.stone }],
  ["bishop", { emoji: "♝", className: PALETTE.violet }],
  ["rook", { emoji: "♜", className: PALETTE.red }],
  ["knight", { emoji: "♞", className: PALETTE.slate }],
  ["queen", { emoji: "♛", className: PALETTE.pink }],
  ["king", { emoji: "♚", className: PALETTE.gold }],
  ["i <3 c", { emoji: "💻", className: PALETTE.sky }],
  ["i <3 python", { emoji: "🐍", className: PALETTE.lime }],
  ["i <3 java", { emoji: "☕", className: PALETTE.orange }],
  ["i <3 c++", { emoji: "🧠", className: PALETTE.indigo }],
  ["i <3 knightwise", { emoji: "💙", className: PALETTE.teal }],
  ["ucf", { emoji: "🛡️", className: PALETTE.gold }],
  ["go knights", { emoji: "⚔️", className: PALETTE.gold }],
  ["usf", { emoji: "🐂", className: PALETTE.emerald }],
  ["go bulls", { emoji: "📣", className: PALETTE.emerald }],
  ["uf", { emoji: "🐊", className: PALETTE.sky }],
  ["go gators", { emoji: "📣", className: PALETTE.sky }],
  ["unf", { emoji: "🦅", className: PALETTE.teal }],
  ["go ospreys", { emoji: "📣", className: PALETTE.teal }],
  ["fsu", { emoji: "🔥", className: PALETTE.red }],
  ["fiu", { emoji: "🐾", className: PALETTE.fuchsia }],
  ["go panthers", { emoji: "📣", className: PALETTE.fuchsia }],
]);

const normalize = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
};

const hashName = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

export const getFlairPresentation = (flairName: string): FlairPresentation => {
  const normalizedName = normalize(flairName);

  const exactStyle = EXACT_STYLES.get(normalizedName);
  if (exactStyle) {
    return exactStyle;
  }

  const paletteIndex = hashName(normalizedName) % FALLBACK_STYLES.length;

  return {
    emoji: DEFAULT_EMOJI,
    className: FALLBACK_STYLES[paletteIndex],
  };
};
