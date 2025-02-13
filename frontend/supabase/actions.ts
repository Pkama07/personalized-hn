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

export const fetchUserProfile = async (id: string) =>
    await adminSupabase
        .from("profiles")
        .select("frequency, weekday, interests")
        .eq("id", id);

export const createProfile = async (id: string) =>
    await adminSupabase.from("profiles").insert({ id }).select();

export const saveProfile = async (
    id: string,
    interests: string,
    frequency: string,
    weekday: string
) => {
    // create the vector in the database if it does not already exist
    // if it does exist, update the fields
    await adminSupabase
        .from("profiles")
        .update({
            frequency,
            interests,
            weekday,
        })
        .eq("id", id);
};
