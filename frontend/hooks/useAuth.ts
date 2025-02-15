import { useState, useEffect } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { secureSignUp } from "@/lib/supabase/actions";
import { User } from "@supabase/supabase-js";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        browserSupabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = browserSupabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signUp = async (email: string, password: string) => {
        const { data, error } = await secureSignUp(email, password);
        return { data, error: error?.message ?? "" };
    };

    const signIn = async (email: string, password: string) => {
        const { data, error } = await browserSupabase.auth.signInWithPassword({
            email,
            password,
        });
        return { data, error: error?.message ?? "" };
    };

    const signOut = async () => {
        await browserSupabase.auth.signOut();
    };

    const sendEmailVerification = async (email: string) => {
        const { data, error } = await browserSupabase.auth.resend({
            type: "signup",
            email,
        });
        return { data, error: error?.message ?? "" };
    };

    return {
        user,
        loading,
        signIn,
        signUp,
        signOut,
        sendEmailVerification,
    };
}
