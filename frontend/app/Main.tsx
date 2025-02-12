"use client";

import { useState } from "react";
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
import { useSearchParams } from "next/navigation";

export default function Main() {
    const { user, loading, signIn, signUp, signOut, sendEmailVerification } =
        useAuth();

    const [isSignIn, setIsSignIn] = useState(true);
    const [isResend, setIsResend] = useState(false);
    const [hasSent, setHasSent] = useState(false);
    const [isFormLoading, setIsFormLoading] = useState(false);
    const toggleSignType = () => {
        setError("");
        setIsSignIn(!isSignIn);
    };
    const toggleIsResend = () => {
        setError("");
        setIsResend(!isResend);
    };
    const [error, setError] = useState(
        useSearchParams().get("error_code") == "otp_expired"
            ? "There was an error verifying your email. Please resend the verification email."
            : ""
    );

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
            <div className="my-6 max-w-96 text-center">
                A newsletter for the content on{" "}
                <a href="https://news.ycombinator.com/" className="underline">
                    Hacker News
                </a>{" "}
                that you're interested in.{" "}
                {user == null &&
                    !loading &&
                    "Sign up to set your preferences and start getting cool news."}
            </div>

            {!loading ? (
                user ? (
                    <Button
                        className="w-fit bg-primary text-accent font-bold hover:opacity-60 transition duration-200"
                        type="button"
                        onClick={() => {
                            setIsFormLoading(true);
                            signOut().then(() => setIsFormLoading(false));
                        }}
                    >
                        {isFormLoading ? (
                            <Spinner className="text-black" />
                        ) : (
                            "Sign out"
                        )}
                    </Button>
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
                                            <div className="text-destructive">
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
                                                            Don't have an
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
        </div>
    );
}
