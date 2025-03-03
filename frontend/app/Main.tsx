"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { signInSchema, signUpSchema, resendSchema } from "@/schema";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Spinner } from "@/components/ui/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    createProfile,
    fetchUserProfile,
    saveProfile,
} from "@/lib/supabase/actions";

const getOrCreateProfile = async (id: string) => {
    let profile = await fetchUserProfile(id);
    if (!profile.data || profile.data.length == 0) {
        profile = await createProfile(id);
    }
    return profile;
};

const DOW = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

export type Frequency = "daily" | "weekly";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export default function Main() {
    const {
        user,
        loading: sessionLoading,
        signIn,
        signUp,
        signOut,
        sendEmailVerification,
    } = useAuth();

    const [isSignIn, setIsSignIn] = useState(true);
    const [isResend, setIsResend] = useState(false);
    const [hasSent, setHasSent] = useState(false);
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const toggleSignType = () => {
        setError("");
        setIsSignIn(!isSignIn);
    };
    const toggleIsResend = () => {
        setError("");
        setIsResend(!isResend);
    };
    const [error, setError] = useState("");

    const [frequency, setFrequency] = useState<Frequency>("daily");
    const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(0);
    const [interests, setInterests] = useState("");
    const [hasLoadedProfile, setHasLoadedProfile] = useState(false);

    useEffect(() => {
        if (!user) return;
        getOrCreateProfile(user.id).then((profile) => {
            if (!profile.data) return;
            const info = profile.data[0];
            setFrequency(info.frequency);
            setDayOfWeek(info.day_of_week);
            setInterests(info.interests);
            setError("");
            setHasLoadedProfile(true);
        });
    }, [user]);

    const currSchema = isResend
        ? resendSchema
        : isSignIn
        ? signInSchema
        : signUpSchema;
    type FormValues = z.infer<typeof currSchema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(currSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const onSubmit = async (formData: FormValues) => {
        setIsFormLoading(true);
        setError("");
        const { error } = await (isResend
            ? sendEmailVerification(formData.email)
            : (isSignIn ? signIn : signUp)(formData.email, formData.password!));
        if (error) {
            setError(`${error}`);
        } else if (isResend || !isSignIn) {
            setHasSent(true);
        }
        setIsFormLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-bold">
                hackern<span className="text-primary">you</span>sletter
            </h1>
            <div className="my-6 max-w-96 text-center md:px-0 px-4">
                A newsletter for the content on{" "}
                <a
                    href="https://news.ycombinator.com/"
                    className="underline text-primary"
                    target="_blank"
                >
                    Hacker News
                </a>{" "}
                that{" "}
                <a
                    className="underline text-primary"
                    target="_blank"
                    href="/how-it-works"
                >
                    you&apos;re interested in
                </a>
                .{" "}
                {user == null &&
                    !sessionLoading &&
                    "Sign up to set your interests and start getting cool news."}
            </div>

            {!sessionLoading && (user ? hasLoadedProfile : true) ? (
                user ? (
                    <Card className="md:w-[600px] w-[80%]">
                        <CardContent className="flex flex-col pt-5 space-y-4">
                            <div className="space-y-4">
                                <Label className="text-lg font-semibold">
                                    Email frequency
                                </Label>
                                <RadioGroup
                                    value={frequency}
                                    onValueChange={(v) =>
                                        setFrequency(v as Frequency)
                                    }
                                    className="flex flex-col space-y-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                            value="daily"
                                            id="daily"
                                        />
                                        <Label htmlFor="daily">Daily</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                            value="weekly"
                                            id="weekly"
                                        />
                                        <Label htmlFor="weekly">Weekly</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            {frequency === "weekly" && (
                                <div className="space-y-2">
                                    <Label htmlFor="day-select">
                                        Select day of the week:
                                    </Label>
                                    <Select
                                        value={dayOfWeek.toString()}
                                        onValueChange={(v) =>
                                            setDayOfWeek(
                                                parseInt(v) as DayOfWeek
                                            )
                                        }
                                    >
                                        <SelectTrigger id="day-select">
                                            <SelectValue placeholder="Select a day" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">
                                                Sunday
                                            </SelectItem>
                                            <SelectItem value="1">
                                                Monday
                                            </SelectItem>
                                            <SelectItem value="2">
                                                Tuesday
                                            </SelectItem>
                                            <SelectItem value="3">
                                                Wednesday
                                            </SelectItem>
                                            <SelectItem value="4">
                                                Thursday
                                            </SelectItem>
                                            <SelectItem value="5">
                                                Friday
                                            </SelectItem>
                                            <SelectItem value="6">
                                                Saturday
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <p className="text-sm opacity-60">
                                You will receive a newsletter every{" "}
                                {frequency == "daily" ? "day" : DOW[dayOfWeek]}{" "}
                                around 8am.
                            </p>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="interests"
                                    className="text-lg font-semibold"
                                >
                                    Interests
                                </Label>
                                <Textarea
                                    id="preferences"
                                    placeholder="I like learning about politics, startups, and AI. I also enjoy watching the NBA and reading manga."
                                    value={interests}
                                    onChange={(e) =>
                                        setInterests(e.target.value)
                                    }
                                    className="min-h-[100px]"
                                />
                                {error && (
                                    <div className="text-destructive text-sm">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-between">
                            <Button
                                className="w-fit border bg-transparent text-accent font-bold hover:opacity-60 transition duration-200"
                                type="button"
                                onClick={() => {
                                    setIsFormLoading(true);
                                    signOut().then(() =>
                                        setIsFormLoading(false)
                                    );
                                }}
                            >
                                {isFormLoading ? (
                                    <Spinner className="text-black" />
                                ) : (
                                    "Sign out"
                                )}
                            </Button>
                            <Button
                                className="w-fit bg-primary text-accent font-bold hover:opacity-60 transition duration-200"
                                type="button"
                                onClick={() => {
                                    setIsSaving(true);
                                    if (interests.length == 0) {
                                        setError(
                                            "Please specify your interests."
                                        );
                                        setIsSaving(false);
                                    } else {
                                        saveProfile(
                                            user.id,
                                            interests,
                                            frequency,
                                            dayOfWeek,
                                            user.email!
                                        ).then(() => setIsSaving(false));
                                    }
                                }}
                            >
                                {isSaving ? (
                                    <Spinner className="text-black" />
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                ) : (
                    <Card className="w-full max-w-md">
                        {hasSent ? (
                            <CardContent className="space-y-4 pt-5 text-center">
                                You have been sent a verification email.
                            </CardContent>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)}>
                                    <CardContent className="space-y-4 pt-5">
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="garry@ycombinator.com"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {!isResend && (
                                            <FormField
                                                control={form.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Password
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="pg@123"
                                                                type="password"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        {!isSignIn && !isResend && (
                                            <FormField
                                                control={form.control}
                                                name="confirmPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Confirm Password
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="pg@123"
                                                                type="password"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        {error && (
                                            <div className="text-destructive text-sm">
                                                {error}
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="flex flex-col space-y-4">
                                        <Button
                                            className="w-full bg-primary text-accent font-bold hover:opacity-60 transition duration-200"
                                            type="submit"
                                            disabled={isFormLoading}
                                        >
                                            {isFormLoading ? (
                                                <Spinner className="text-black" />
                                            ) : isResend ? (
                                                "Resend"
                                            ) : isSignIn ? (
                                                "Login"
                                            ) : (
                                                "Sign Up"
                                            )}
                                        </Button>
                                        {isResend ? (
                                            <button
                                                className="text-primary hover:cursor-pointer"
                                                onClick={toggleIsResend}
                                                type="button"
                                            >
                                                Go back
                                            </button>
                                        ) : (
                                            <div>
                                                <div className="w-full text-accent flex justify-center">
                                                    {isSignIn ? (
                                                        <div className="flex justify-center items-center">
                                                            Don&apos;t have an
                                                            account?
                                                            <button
                                                                className="text-primary hover:cursor-pointer ml-1"
                                                                onClick={
                                                                    toggleSignType
                                                                }
                                                                type="button"
                                                            >
                                                                Sign up
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-center items-center">
                                                            Already have an
                                                            account?
                                                            <button
                                                                className="text-primary hover:cursor-pointer ml-1"
                                                                onClick={
                                                                    toggleSignType
                                                                }
                                                                type="button"
                                                            >
                                                                Login
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-full text-accent flex justify-center">
                                                    <div className="flex justify-center items-center">
                                                        Need to
                                                        <button
                                                            className="text-primary hover:cursor-pointer mx-1"
                                                            onClick={
                                                                toggleIsResend
                                                            }
                                                            type="button"
                                                        >
                                                            verify
                                                        </button>
                                                        your email?
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardFooter>
                                </form>
                            </Form>
                        )}
                    </Card>
                )
            ) : (
                <Spinner />
            )}
            <div className="flex flex-row space-x-2 my-6 items-center">
                <Button
                    className="text-black font-semibold hover:bg-transparent hover:shadow-md transition duration-200"
                    variant="outline"
                    onClick={() => {
                        window.open("/how-it-works", "_blank");
                    }}
                >
                    How it works
                </Button>
                <Button
                    className="text-black font-semibold hover:bg-transparent hover:shadow-md transition duration-200"
                    variant="outline"
                    onClick={() => {
                        window.open("/writeup", "_blank");
                    }}
                >
                    Writeup
                </Button>
            </div>
        </div>
    );
}
