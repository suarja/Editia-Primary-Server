import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "editia-core";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// In test environment, use default values to prevent import errors
const isTestEnv = process.env.NODE_ENV === 'test';

if (!supabaseUrl && !isTestEnv) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!supabaseServiceRoleKey && !isTestEnv) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient<Database>(
  supabaseUrl || 'https://test.supabase.co',
  supabaseServiceRoleKey || 'test-service-role-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Test connection function
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("count", { count: "exact", head: true });

    if (error) {
      console.error("❌ Supabase connection test failed:", error.message);
      return false;
    }

    console.log("✅ Supabase connection successful");
    return true;
  } catch (error) {
    console.error("❌ Supabase connection test error:", error);
    return false;
  }
}
