"use client";

import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { getVector, updateUserValues } from "@/lib/pinecone";
import { getItem } from "@/lib/supabase/actions";
import { RecordValues } from "@pinecone-database/pinecone";
import { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const ALPHA = 0.98;

export default function Redirect() {
    const { user, loading } = useAuth();
    const itemId = useSearchParams().get("item_id");
    useEffect(() => {
        if (loading) return;
        processClick(user, itemId);
    }, [loading, user, itemId]);
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="text-center space-y-4">
                <Spinner className="w-12 h-12 animate-spin text-primary mx-auto" />
                <p className="text-lg font-medium text-muted-foreground">
                    {!user ? "" : "Updating your preference and redirecting..."}
                </p>
            </div>
        </div>
    );
}

async function processClick(user: User | null, itemId: string | null) {
    if (!itemId || !user) {
        redirect("/");
    }
    const { data } = await getItem(itemId);
    if (!data || data.length == 0) {
        redirect("/");
    }
    const existingVectorValues = (await getVector(user.id, "users")).records[
        user.id
    ].values;
    const itemVectorValues = (await getVector(itemId, "items")).records[itemId]
        .values;
    let interpolatedMagnitude = 0;
    let result: RecordValues = [];
    for (let i = 0; i < existingVectorValues.length; i++) {
        const value =
            existingVectorValues[i] * ALPHA + itemVectorValues[i] * (1 - ALPHA);
        result.push(value);
        interpolatedMagnitude += value * value;
    }
    interpolatedMagnitude = Math.sqrt(interpolatedMagnitude);
    result = result.map((val) => val / interpolatedMagnitude);
    await updateUserValues(user.id, result);
    redirect(data[0].url);
}
