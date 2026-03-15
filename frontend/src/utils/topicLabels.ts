export const formatSubcategoryLabel = (subcategory?: string): string => {
  const value = String(subcategory || "").trim();
  if (!value) {
    return "";
  }

  return value === "InputOutput" ? "Input/Output" : value;
};