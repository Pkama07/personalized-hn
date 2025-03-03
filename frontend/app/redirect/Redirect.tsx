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
        if (!itemId) redirect("/");
        if (!user) {
            setTimeout(async () => {
                getItem(itemId).then(({ data }) => {
                    if (data && data.length > 0) {
                        redirect(data[0].url);
                    } else {
                        redirect("/");
                    }
                });
            }, 2000);
        } else {
            processClick(user, itemId);
        }
    }, [loading, user, itemId]);
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="text-center space-y-4">
                <Spinner className="w-12 h-12 animate-spin text-primary mx-auto" />
                <div className="text-lg font-medium text-muted-foreground">
                    {loading ? (
                        ""
                    ) : !user ? (
                        <>
                            <p>
                                Please log into hackernyousletter on this device
                                to update your preferences.
                            </p>
                            <p>You will be redirected in a few seconds.</p>
                        </>
                    ) : (
                        "Updating your preference and redirecting..."
                    )}
                </div>
            </div>
        </div>
    );
}

async function processClick(user: User, itemId: string) {
    const { data } = await getItem(itemId);
    if (!data || data.length == 0) {
        redirect("/");
    }
    const userVectorValues = (await getVector(user.id, "users")).records[
        user.id
    ].values;
    const itemVectorValues = (await getVector(itemId, "items")).records[itemId]
        .values;
    let interpolatedMagnitude = 0;
    let result: RecordValues = [];
    for (let i = 0; i < userVectorValues.length; i++) {
        const value =
            userVectorValues[i] * ALPHA + itemVectorValues[i] * (1 - ALPHA);
        result.push(value);
        interpolatedMagnitude += value * value;
    }
    interpolatedMagnitude = Math.sqrt(interpolatedMagnitude);
    result = result.map((val) => val / interpolatedMagnitude);
    await updateUserValues(user.id, result);
    redirect(data[0].url);
}
