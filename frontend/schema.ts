import { z } from "zod";

export const signInSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
    password: z.string(),
});

export const signUpSchema = z
    .object({
        email: z.string().email({
            message: "Please enter a valid email address.",
        }),
        password: z.string().min(6, {
            message: "Password must be at least 6 characters.",
        }),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password == data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

export const resendSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
    password: z.string().optional(),
});
