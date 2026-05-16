"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AuthActionState,
  signInAnonymously,
  signInBidder,
  signUpBidder,
} from "@/lib/auth/actions";

const initial: AuthActionState = { ok: false };

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    signInBidder,
    initial,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpBidder,
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {mode === "signin" ? "Welcome back" : "Create an account"}
        </CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Sign in to place bids and track your watchlist."
            : "Sign up to start bidding on auction items."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "signin" ? (
          <form action={signInAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {signInState.error && (
              <p className="text-sm text-destructive">{signInState.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={signInPending}>
              {signInPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <form action={signUpAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Display name</Label>
              <Input
                id="signup-name"
                name="displayName"
                required
                minLength={1}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone (optional)</Label>
              <Input
                id="signup-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters.
              </p>
            </div>
            {signUpState.error && (
              <p className="text-sm text-destructive">{signUpState.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={signUpPending}>
              {signUpPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form action={signInAnonymously}>
          <Button type="submit" variant="outline" className="w-full">
            Continue as guest
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Button
          type="button"
          variant="link"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </Button>
      </CardFooter>
    </Card>
  );
}
