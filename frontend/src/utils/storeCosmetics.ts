const PROFILE_PICTURE_ASSETS = import.meta.glob(
  "../assets/store/pfp/*.{png,jpg,jpeg,webp,svg,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;

const BACKGROUND_ASSETS = import.meta.glob(
  "../assets/store/bg/*.{png,jpg,jpeg,webp,svg,avif,gif}",
  { eager: true, import: "default" }
) as Record<string, string>;

const KNOWN_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "svg", "avif", "gif"];

const getFileNameWithoutExtension = (assetPath: string): string => {
  const lastSegment = assetPath.split("/").pop() || "";
  return lastSegment.replace(/\.[^.]+$/, "");
};

const normalizeName = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.(png|jpe?g|webp|svg|avif|gif)$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[-_]+/g, " ");
};

const buildNameMap = (assets: Record<string, string>): Map<string, string> => {
  const map = new Map<string, string>();

  Object.entries(assets).forEach(([assetPath, assetUrl]) => {
    const fileName = getFileNameWithoutExtension(assetPath);
    map.set(normalizeName(fileName), assetUrl);
  });

  return map;
};

const profilePictureMap = buildNameMap(PROFILE_PICTURE_ASSETS);
const backgroundMap = buildNameMap(BACKGROUND_ASSETS);

const hasKnownExtension = (name: string): boolean => {
  return /\.(png|jpe?g|webp|svg|avif|gif)$/i.test(name.trim());
};

const encodePathSegment = (value: string): string => {
  return encodeURIComponent(value.trim());
};

const buildPublicAssetCandidates = (folder: "pfp" | "bg", name: string): string[] => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return [];
  }

  if (hasKnownExtension(trimmedName)) {
    return [`/assets/store/${folder}/${encodePathSegment(trimmedName)}`];
  }

  return KNOWN_EXTENSIONS.map((ext) => `/assets/store/${folder}/${encodePathSegment(trimmedName)}.${ext}`);
};

const resolveAssetUrl = (name: string, map: Map<string, string>): string | null => {
  return map.get(normalizeName(name)) || null;
};

export const getProfilePictureUrlByItemName = (name: string): string | null => {
  return resolveAssetUrl(name, profilePictureMap) || buildPublicAssetCandidates("pfp", name)[0] || null;
};

export const getBackgroundUrlByItemName = (name: string): string | null => {
  return resolveAssetUrl(name, backgroundMap) || buildPublicAssetCandidates("bg", name)[0] || null;
};
