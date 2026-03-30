interface ProfilePathInput {
  userId?: number | string | null;
  id?: number | string | null;
  ID?: number | string | null;
  username?: string | null;
  fallbackToOwnProfile?: boolean;
}

export const getProfilePathForUser = (input: ProfilePathInput): string | null => {
  const resolvedId = Number(input.userId ?? input.id ?? input.ID);
  if (Number.isInteger(resolvedId) && resolvedId > 0) {
    return `/profile/${resolvedId}`;
  }

  const username = (input.username || "").trim();
  if (username) {
    return `/profile/u/${encodeURIComponent(username)}`;
  }

  return input.fallbackToOwnProfile ? "/profile" : null;
};
