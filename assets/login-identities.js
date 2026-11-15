// These addresses identify Supabase accounts; they are not captain mailboxes.
// Team access is always enforced by server-side membership, never this mapping.
const accountDomain = "captains.highpeakandmarplesnookerleague.co.uk";

export const captainAccounts = [
  { teamId: "alexashton", username: "alexashton", aliases: ["AlexAshton"] },
  { teamId: "chinley", username: "chinley", aliases: ["Chinley"] },
  {
    teamId: "denton-lib",
    username: "denton",
    aliases: ["Denton LC", "Denton Lib", "Denton Library"],
  },
  { teamId: "hayfield-1", username: "hayfield1", aliases: ["Hayfield 1"] },
  { teamId: "hayfield-2", username: "hayfield2", aliases: ["Hayfield 2"] },
  { teamId: "marple", username: "marple", aliases: ["Marple"] },
  { teamId: "tintwistle1", username: "tintwistle1", aliases: ["Tintwistle 1"] },
  { teamId: "tintwistle2", username: "tintwistle2", aliases: ["Tintwistle 2"] },
  { teamId: "whaley-1", username: "whaley1", aliases: ["Whaley 1"] },
  { teamId: "whaley-2", username: "whaley2", aliases: ["Whaley 2"] },
].map((account) =>
  Object.freeze({
    ...account,
    email: `${account.username}@${accountDomain}`,
  }),
);

const normalise = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function loginEmail(identifier) {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();
  const account = captainAccounts.find((account) =>
    [account.username, account.teamId, ...account.aliases].some(
      (alias) => normalise(alias) === normalise(value),
    ),
  );
  if (!account) {
    throw new Error(
      "Enter your team username, such as marple. Administrators can sign in with their email address.",
    );
  }
  return account.email;
}

export function captainUsername(teamId) {
  return (
    captainAccounts.find((account) => account.teamId === teamId)?.username ||
    teamId
  );
}
