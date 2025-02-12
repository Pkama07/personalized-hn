"use server";

import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const secureSignUp = async (email: string, password: string) =>
    await adminSupabase.auth.signUp({
        email,
        password,
    });
