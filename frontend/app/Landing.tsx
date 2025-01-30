"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Landing() {
    const [isLogin, setIsLogin] = useState(true);

    const toggleForm = () => setIsLogin(!isLogin);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-bold mb-8">
                hackern<span className="text-primary">you</span>sletter
            </h1>

            <Card className="w-full max-w-md">
                <CardContent className="space-y-4 pt-5">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="jared@ycombinator.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="pg_123"
                            required
                        />
                    </div>
                    {!isLogin && (
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">
                                Confirm Password
                            </Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                placeholder="pg_123"
                                required
                            />
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <Button className="w-full bg-primary text-accent font-bold hover:opacity-60 transition duration-200">
                        {isLogin ? "Login" : "Sign Up"}
                    </Button>
                    <div className="w-full text-accent flex justify-center">
                        {isLogin ? (
                            <div className="flex justify-center items-center">
                                Don't have an account?
                                <button
                                    className="text-primary hover:cursor-pointer ml-1"
                                    onClick={toggleForm}
                                >
                                    Sign up
                                </button>
                            </div>
                        ) : (
                            <div className="flex justify-center items-center">
                                Already have an account?
                                <button
                                    className="text-primary hover:cursor-pointer ml-1"
                                    onClick={toggleForm}
                                >
                                    Login
                                </button>
                            </div>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
