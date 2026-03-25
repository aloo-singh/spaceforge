"use client";

import { useActionState } from "react";

import { loginAdminAction, type AdminLoginActionState } from "@/app/admin/login/actions";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AdminLoginFormProps = {
  signedInEmail: string | null;
};

const initialState: AdminLoginActionState = {
  error: null,
};

export function AdminLoginForm({ signedInEmail }: AdminLoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAdminAction, initialState);

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-muted/20 px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <BrandWordmark className="text-xl" />
            </div>
            <div className="space-y-1">
              <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
                Admin Login
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Sign in to continue
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Internal access for the admin workspace.
              </p>
            </div>
          </div>

          {signedInEmail ? (
            <div className="rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Signed in with <span className="font-medium text-foreground/80">{signedInEmail}</span>,
              but this account is not in <code>ADMIN_EMAILS</code>.
            </div>
          ) : null}

          {state.error ? (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                defaultValue={signedInEmail ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
