import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { storage } from "@/src/utils/storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Supabase auth storage adapter over the shared storage singleton.
const supaStorage = {
  getItem: (k: string) => storage.getItem(k, null),
  setItem: async (k: string, v: string) => {
    await storage.setItem(k, v);
  },
  removeItem: async (k: string) => {
    await storage.removeItem(k);
  },
};

export const supabase = createClient(url, key, {
  auth: {
    storage: supaStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
