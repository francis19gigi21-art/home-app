import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import type { Household, HouseholdMember, Profile, UserPreferences } from "@/src/lib/types";

type AppContextValue = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  preferences: UserPreferences | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (redirectTo: string) => Promise<string | null>;
  resetPassword: (email: string, redirectTo: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: (name: string) => Promise<Household>;
  joinHousehold: (code: string) => Promise<void>;
  refreshHousehold: () => Promise<void>;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function makeInviteCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  const loadUserData = useCallback(async (userId: string) => {
    // Profile (create if trigger missed)
    let { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!prof) {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email ?? null;
      const name = (authData.user?.user_metadata?.full_name as string) ?? null;
      const { data: created } = await supabase
        .from("profiles")
        .upsert({ id: userId, email, full_name: name ?? email?.split("@")[0] ?? "Member" })
        .select()
        .single();
      prof = created;
    }
    setProfile(prof as Profile);

    // Preferences
    let { data: prefs } = await supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (!prefs) {
      const { data: created } = await supabase.from("user_preferences").upsert({ user_id: userId }).select().single();
      prefs = created;
    }
    setPreferences(prefs as UserPreferences);

    // Household (first membership)
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setHousehold(null);
      setMembers([]);
      return;
    }
    const { data: house } = await supabase.from("households").select("*").eq("id", membership.household_id).single();
    setHousehold(house as Household);

    const { data: membs } = await supabase
      .from("household_members")
      .select("*, profiles(*)")
      .eq("household_id", membership.household_id)
      .order("joined_at", { ascending: true });
    setMembers((membs ?? []) as HouseholdMember[]);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadUserData(data.session.user.id);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess?.user) await loadUserData(sess.user.id);
      else {
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setPreferences(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadUserData]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo: string) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw new Error(error.message);
    return data.url ?? null;
  }, []);

  const resetPassword = useCallback(async (email: string, redirectTo: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshHousehold = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loadUserData(data.user.id);
  }, [loadUserData]);

  const createHousehold = useCallback(
    async (name: string): Promise<Household> => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Not signed in");
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const invite_code = makeInviteCode();
        const { data: house, error } = await supabase
          .from("households")
          .insert({ name: name.trim(), invite_code, created_by: user.id })
          .select()
          .single();
        if (error) {
          lastError = new Error(error.message);
          continue;
        }
        const { error: memErr } = await supabase
          .from("household_members")
          .insert({ household_id: house.id, user_id: user.id, role: "owner" });
        if (memErr) throw new Error(memErr.message);
        await refreshHousehold();
        return house as Household;
      }
      throw lastError ?? new Error("Could not create household");
    },
    [refreshHousehold],
  );

  const joinHousehold = useCallback(
    async (code: string) => {
      const { error } = await supabase.rpc("join_household", { code: code.trim() });
      if (error) throw new Error("Invalid invite code. Check the code and try again.");
      await refreshHousehold();
    },
    [refreshHousehold],
  );

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (!session?.user) return;
      const { data, error } = await supabase
        .from("user_preferences")
        .update(patch)
        .eq("user_id", session.user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setPreferences(data as UserPreferences);
    },
    [session?.user],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!session?.user) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", session.user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setProfile(data as Profile);
    },
    [session?.user],
  );

  const value = useMemo(
    () => ({
      loading,
      session,
      profile,
      household,
      members,
      preferences,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      signOut,
      createHousehold,
      joinHousehold,
      refreshHousehold,
      updatePreferences,
      updateProfile,
    }),
    [
      loading, session, profile, household, members, preferences,
      signIn, signUp, signInWithGoogle, resetPassword, signOut,
      createHousehold, joinHousehold, refreshHousehold, updatePreferences, updateProfile,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function displayNameOf(m?: HouseholdMember | null): string {
  if (!m) return "Unassigned";
  return m.profiles?.full_name?.trim() || m.profiles?.email?.split("@")[0] || "Member";
}
