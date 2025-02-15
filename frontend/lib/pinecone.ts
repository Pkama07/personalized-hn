"use server";

import { DayOfWeek, Frequency } from "@/app/Main";
import { Index, Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

const checkIfVectorExists = async (
    id: string,
    index: Index<RecordMetadata>
) => {
    const fetchResult = await index.namespace("users").fetch([id]);
    return Object.entries(fetchResult.records).length != 0;
};

const calculateLastUpdated = (frequency: Frequency, dayOfWeek: DayOfWeek) => {
    switch (frequency) {
        case "daily":
            const now = new Date();
            const today8AM = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                8,
                0,
                0,
                0
            );
            if (now < today8AM) {
                today8AM.setDate(today8AM.getDate() - 1);
            }
            return Math.floor(today8AM.getTime() / 1000);
        case "weekly":
            const targetDate = new Date();
            let daysToSubtract = targetDate.getDay() - dayOfWeek;
            if (daysToSubtract < 0) daysToSubtract += 7;
            targetDate.setDate(targetDate.getDate() - daysToSubtract);
            targetDate.setHours(8, 0, 0, 0);
            return Math.floor(targetDate.getTime() / 1000);
    }
};

export const saveUserVector = async (
    id: string,
    interests: string,
    frequency: Frequency,
    dayOfWeek: DayOfWeek,
    email: string
) => {
    const interestEmbedding = await pc.inference.embed(
        "multilingual-e5-large",
        [interests],
        { inputType: "passage" }
    );
    if (!interestEmbedding[0].values)
        return { success: false, error: "could not create embedding" };
    const newsIndex = pc.Index("news");
    const isVectorPresent = await checkIfVectorExists(id, newsIndex);
    const lastUpdated = calculateLastUpdated(frequency, dayOfWeek);
    if (isVectorPresent) {
        newsIndex.namespace("users").update({
            id,
            values: interestEmbedding[0].values,
            metadata: {
                description: interests,
                last_updated: lastUpdated,
            },
        });
    } else {
        newsIndex.namespace("users").upsert([
            {
                id,
                values: interestEmbedding[0].values,
                metadata: {
                    description: interests,
                    type: frequency,
                    last_updated: lastUpdated,
                    email: email,
                    count: 10,
                },
            },
        ]);
    }
    return { success: true, error: "" };
};
