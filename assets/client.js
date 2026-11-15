import { createClient } from "./supabase.js";
import { config } from "./config.js";
export const authLinkType = new URLSearchParams(location.hash.slice(1)).get(
  "type",
);
export const configured = Boolean(
  config.supabaseUrl && config.supabasePublishableKey,
);
export const client = configured
  ? createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export async function rpc(name, params = {}) {
  if (!client) throw new Error("The live service has not been connected yet.");
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(error.message);
  return data;
}
export async function loadSnapshot() {
  if (configured) return rpc("league_snapshot", { p_season: config.season });
  const response = await fetch("/data/new-season.json");
  if (!response.ok)
    throw new Error(
      "The season information could not be loaded. Please try again.",
    );
  return response.json();
}

export async function manageCaptainAccount(team, password) {
  if (!client) throw new Error("The live service has not been connected yet.");
  const { data, error } = await client.functions.invoke(
    "manage-captain-account",
    {
      body: { team, password },
    },
  );
  if (error) {
    let message =
      "The team account could not be updated. Check your connection or ask the project owner to finish account setup.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
    }
    throw new Error(message);
  }
  if (data?.error || !data?.username)
    throw new Error(
      data?.error || "The account update could not be confirmed.",
    );
  return data;
}
