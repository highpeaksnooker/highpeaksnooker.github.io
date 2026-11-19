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
export async function loadSeasonCatalog() {
  if (!configured) return {installed:false};
  try { const catalog=await rpc("season_catalog");if(catalog.active_season){try{window.localStorage.setItem("league-active-season",catalog.active_season);}catch{}}return catalog; } catch { return {installed:false}; }
}
export async function loadSnapshot() {
  if (configured) {
    const lifecycle=await loadSeasonCatalog();
    let lastSeason;try{lastSeason=window.localStorage.getItem("league-active-season");}catch{}
    const snapshot=await rpc("league_snapshot", {p_season:lifecycle.active_season || lastSeason || config.season});
    snapshot.lifecycle=lifecycle;
    if(lifecycle.installed && snapshot.membership?.role === "admin") {
      try {
        snapshot.seasonClose=await rpc("season_close_preview",{p_season:snapshot.season.id});
        snapshot.previousSeasonCloses=await Promise.all((lifecycle.archives||[]).map(season=>rpc("season_close_preview",{p_season:season.id})));
      } catch { snapshot.seasonClose=null; }
    }
    return snapshot;
  }
  const response=await fetch("/data/new-season.json");
  if(!response.ok)throw new Error("The season information could not be loaded. Please try again.");
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

export async function captainPinStatus() {
  if (!configured) return {ready:false,teams:[]};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4000);
  try {
    const response=await fetch(config.supabaseUrl+'/functions/v1/captain-pin',{headers:{apikey:config.supabasePublishableKey},signal:controller.signal,cache:'no-store'});
    if(!response.ok)return {ready:false,teams:[]};
    const data=await response.json();
    return {ready:data.ready===true,teams:Array.isArray(data.teams)?data.teams.filter(team=>typeof team==='string'):[]};
  }catch{return {ready:false,teams:[]};}finally{clearTimeout(timeout);}
}
async function pinAction(action,team,pin) {
  if(!client)throw new Error('Sign-in is not connected.');
  const {data,error}=await client.functions.invoke('captain-pin',{body:{action,team,...(pin===undefined?{}:{pin})}});
  if(error){let message='PIN sign-in is unavailable. Please try again.';if(error.context instanceof Response){const body=await error.context.json().catch(()=>null);if(typeof body?.error==='string')message=body.error;}throw new Error(message);}
  if(data?.error)throw new Error(data.error);return data;
}
export async function signInCaptainPin(team,pin) {
  if(!/^\d{4}$/.test(pin))throw new Error('Enter your four-digit team PIN.');
  const data=await pinAction('login',team,pin);
  if(!data?.session?.access_token||!data.session.refresh_token)throw new Error('Sign-in could not be confirmed.');
  const result=await client.auth.setSession(data.session);if(result.error)throw result.error;return result;
}
export const setCaptainPin=(team,pin)=>pinAction('set',team,pin);
export const unlockCaptainPin=team=>pinAction('unlock',team);
