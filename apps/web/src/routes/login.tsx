import { Checkbox } from "@Alumni-Tracking-Ss/ui/components/checkbox";
import { Input } from "@Alumni-Tracking-Ss/ui/components/input";
import { Label } from "@Alumni-Tracking-Ss/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FieldGroup } from "@/components/field";
import { FormField, PageHeader, PrimaryButton } from "@/components/page-header";
import { postJson } from "@/lib/session";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (
        container: HTMLElement,
        parameters: { sitekey: string; callback: (token: string) => void },
      ) => number;
    };
  }
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-027 - implement the sign-in / sign-up screen.
//
// Required behaviour (see docs/system/user-guide.md):
//   - one form, two modes, switched by a text button at the bottom
//   - POST to /api/auth/login or /api/auth/signup via postJson() (not the oRPC client,
//     because these two routes also set the session cookie server-side)
//   - read orpc.auth.config to decide whether to render the reCAPTCHA widget or, when the
//     module is enabled but not configured, the local "I am not a robot" checkbox
//   - render the Google sign-in link only when config.google.enabled
//   - invalidate the query cache after success, then navigate to /dashboard
//   - show the server's error message verbatim in a toast
//
// Seeded credentials are printed on this screen; remove that line once real accounts exist.
function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const configQuery = useQuery(orpc.auth.config.queryOptions());

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localBotCheck, setLocalBotCheck] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const config = configQuery.data;
  const recaptchaEnabled = Boolean(config?.recaptcha.enabled);
  const recaptchaLive = Boolean(config?.recaptcha.live && config.recaptcha.siteKey);
  const googleEnabled = Boolean(config?.google.enabled);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google") {
      toast.error("Google sign-in failed.");
    }
  }, []);

  useEffect(() => {
    if (!recaptchaLive || !config?.recaptcha.siteKey) {
      return;
    }

    const siteKey = config.recaptcha.siteKey;
    const existing = document.querySelector<HTMLScriptElement>("script[data-recaptcha]");
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptcha = "true";
    document.head.appendChild(script);
  }, [recaptchaLive, config?.recaptcha.siteKey]);

  async function resolveRecaptchaToken() {
    if (!recaptchaEnabled) {
      return { recaptchaToken: undefined, recaptchaFallback: undefined };
    }

    if (recaptchaLive && config?.recaptcha.siteKey) {
      const siteKey = config.recaptcha.siteKey;
      await new Promise<void>((resolve, reject) => {
        const started = Date.now();
        const wait = () => {
          if (window.grecaptcha?.execute) {
            window.grecaptcha.ready(() => resolve());
            return;
          }
          if (Date.now() - started > 8_000) {
            reject(new Error("reCAPTCHA failed to load."));
            return;
          }
          window.setTimeout(wait, 100);
        };
        wait();
      });

      const token = await window.grecaptcha!.execute(siteKey, { action: mode });
      return { recaptchaToken: token, recaptchaFallback: undefined };
    }

    if (!localBotCheck) {
      throw new Error('Confirm "I am not a robot" to continue.');
    }

    return { recaptchaToken: undefined, recaptchaFallback: true };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      const captcha = await resolveRecaptchaToken();
      if (mode === "login") {
        await postJson("/api/auth/login", {
          email,
          password,
          ...captcha,
        });
      } else {
        await postJson("/api/auth/signup", {
          name,
          email,
          password,
          ...captcha,
        });
      }

      await queryClient.clear();
      toast.success(mode === "login" ? "Signed in" : "Account created");
      await navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setPending(false);
      setRecaptchaToken(undefined);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 border border-border/70 bg-background p-6 shadow-sm">
        <PageHeader
          title="Alumni Tracking System"
          description={
            mode === "login"
              ? "Sign in with your staff account."
              : "Create an account to get started."
          }
        />

        <form onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup>
            {mode === "signup" ? (
              <FormField id="name" label="Name">
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </FormField>
            ) : null}

            <FormField id="email" label="Email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </FormField>

            <FormField id="password" label="Password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </FormField>

            {recaptchaEnabled && !recaptchaLive ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bot-check"
                  checked={localBotCheck}
                  onCheckedChange={(checked) => setLocalBotCheck(checked === true)}
                />
                <Label htmlFor="bot-check">I am not a robot</Label>
              </div>
            ) : null}

            {recaptchaEnabled && recaptchaLive ? (
              <p className="text-xs text-muted-foreground">
                Protected by Google reCAPTCHA.
                {recaptchaToken ? " Token ready." : ""}
              </p>
            ) : null}

            <PrimaryButton type="submit" pending={pending} className="w-full">
              {mode === "login" ? "Sign in" : "Create account"}
            </PrimaryButton>
          </FieldGroup>
        </form>

        {googleEnabled ? (
          <a
            href="/api/auth/google"
            className="inline-flex h-8 w-full items-center justify-center border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
          >
            Continue with Google
          </a>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Need an account?" : "Already registered?"}{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Seeded admin: admin@alumni.local / Admin123!
        </p>
      </div>
    </div>
  );
}
