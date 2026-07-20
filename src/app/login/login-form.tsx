"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2 } from "lucide-react";

const DEMO = [
  { email: "planner@inep.go.ke", label: "National Planner", hint: "sees every county" },
  { email: "makueni@inep.go.ke", label: "Makueni Officer", hint: "one county only" },
  { email: "admin@inep.go.ke", label: "Administrator", hint: "users & templates" },
];

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signIn, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-brand text-white p-12">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-white/15 grid place-items-center">
            <Zap className="size-5" />
          </div>
          <span className="font-medium text-lg">INEP Platform</span>
        </div>
        <div className="space-y-5 max-w-md">
          <h1 className="text-3xl font-medium leading-tight">
            Kenya&apos;s Integrated National Energy Plan, in one place.
          </h1>
          <p className="text-white/80 leading-relaxed">
            Counties, national providers, and private-sector organizations submit energy data one
            shared way. Agents check it, the real approval chain routes it, and planners see the
            national picture without digging through spreadsheets.
          </p>
        </div>
        <p className="text-white/60 text-sm">Ministry of Energy · Republic of Kenya</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-brand grid place-items-center text-white">
              <Zap className="size-5" />
            </div>
            <span className="font-medium text-lg">INEP Platform</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-medium">Sign in</h2>
            <p className="text-muted-foreground text-sm">
              Use your official account to access the platform.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@inep.go.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {state.error && (
              <p className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">
              Demo accounts (password <code className="text-foreground">Inep2026!</code>) — click to
              fill:
            </p>
            <div className="grid gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("Inep2026!");
                  }}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-brand hover:bg-brand-soft/40 transition-colors"
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs text-muted-foreground">{d.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
