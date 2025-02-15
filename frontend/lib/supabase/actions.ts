"use server";

import { createClient } from "@supabase/supabase-js";
import { saveUserVector } from "../pinecone";
import { DayOfWeek, Frequency } from "@/app/Main";

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
        .select("frequency, day_of_week, interests")
        .eq("id", id);

export const createProfile = async (id: string) =>
    await adminSupabase.from("profiles").insert({ id }).select();

export const saveProfile = async (
    id: string,
    interests: string,
    frequency: Frequency,
    dayOfWeek: DayOfWeek,
    email: string
) => {
    await adminSupabase
        .from("profiles")
        .update({
            frequency,
            interests,
            day_of_week: dayOfWeek,
        })
        .eq("id", id);
    await saveUserVector(id, interests, frequency, dayOfWeek, email);
};
