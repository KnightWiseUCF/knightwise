const parseFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const roundToTenths = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 10) / 10;
};

export const formatTenths = (value: unknown, fallback = "0"): string => {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) {
    return fallback;
  }

  const rounded = roundToTenths(parsed);
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
};

export const formatTenthsLocale = (
  value: unknown,
  fallback = "0",
  locales?: Intl.LocalesArgument
): string => {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) {
    return fallback;
  }

  return roundToTenths(parsed).toLocaleString(locales, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
};
