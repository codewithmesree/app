"use client";

import { ArrowRight, Landmark, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { BankLinkingBadge } from "@/components/bank-linking/bank-linking-badge";
import { BankStateSwitcher } from "@/components/bank-linking/bank-state-switcher";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { getCurrency } from "@/features/currency/currencies";
import { getCountry } from "@/features/travel/countries";
import { useTravellerPreferences } from "@/features/travel/traveller-preferences";
import { formatDateTimeUtc } from "@/lib/format-date";

export function SettingsPanel() {
  const { preferences } = useTravellerPreferences();
  const { state, disconnect } = useBankLinking();
  const { status, account } = state;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Bank Connection Section (Requirement 6) */}
        <Reveal>
          <Card aria-labelledby="bank-heading" className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeader id="bank-heading" title="Bank connection" />
              <BankLinkingBadge status={status} />
            </div>

            {status === "linked" && account ? (
              <div className="flex flex-col gap-3">
                <dl className="grid gap-2.5 text-sm">
                  <Row term="Institution">{account.institutionName}</Row>
                  <Row term="Masked account">
                    <span className="font-mono">{account.maskedAccountNumber}</span>
                  </Row>
                  <Row term="Account type">{account.accountType}</Row>
                  <Row term="Linked on">{formatDateTimeUtc(account.linkedAt)}</Row>
                  <Row term="Payment eligibility">
                    <span className="font-medium text-success">Enabled (Sandbox Mandate)</span>
                  </Row>
                </dl>

                <div className="mt-2 flex items-center gap-2 rounded-control border border-line bg-canvas p-3 text-xs text-ink-muted">
                  <ShieldCheck aria-hidden className="size-4 shrink-0 text-success" />
                  Credentials remain server-side. No passwords or PINs are stored.
                </div>

                <div className="mt-auto pt-2">
                  <Button
                    variant="ghost"
                    onClick={disconnect}
                    className="text-xs text-danger hover:bg-danger/10 hover:text-danger sm:text-sm"
                  >
                    <Unplug aria-hidden className="size-4 shrink-0" />
                    Disconnect bank account
                  </Button>
                </div>
              </div>
            ) : null}

            {status === "not_linked" ? (
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-sm text-ink-muted">
                  No bank account is currently linked. You are in <strong>explore-only mode</strong>. You can
                  browse merchants and currency estimates freely.
                </p>
                <div className="rounded-control border border-line bg-canvas p-3 text-xs text-ink-muted">
                  <p>To enable PayPal Sandbox test payments, link an account using our secure simulation.</p>
                </div>
                <div className="mt-auto pt-2">
                  <ButtonLink href="/connect-bank" variant="primary" className="self-start">
                    <Landmark aria-hidden className="size-4 shrink-0" />
                    Connect bank account
                  </ButtonLink>
                </div>
              </div>
            ) : null}

            {status === "connection_expired" ? (
              <div className="flex flex-1 flex-col gap-3">
                <Alert tone="warning" title="Session Expired">
                  Your banking authorization token has expired. Re-authenticate to resume payments.
                </Alert>
                {account ? (
                  <p className="font-mono text-xs text-ink-muted">
                    Previous account: {account.institutionName} ({account.maskedAccountNumber})
                  </p>
                ) : null}
                <div className="mt-auto pt-2">
                  <ButtonLink href="/connect-bank" variant="secondary" className="self-start text-warning">
                    <RefreshCw aria-hidden className="size-4 shrink-0" />
                    Reconnect account
                  </ButtonLink>
                </div>
              </div>
            ) : null}

            {status === "reconnection_required" ? (
              <div className="flex flex-1 flex-col gap-3">
                <Alert tone="warning" title="Reconnection Required">
                  The banking provider requires you to re-consent to open-banking authorization.
                </Alert>
                <div className="mt-auto pt-2">
                  <ButtonLink href="/connect-bank" variant="secondary" className="self-start text-warning">
                    <RefreshCw aria-hidden className="size-4 shrink-0" />
                    Complete re-consent
                  </ButtonLink>
                </div>
              </div>
            ) : null}

            {status === "linking_failed" ? (
              <div className="flex flex-1 flex-col gap-3">
                <Alert tone="danger" title="Connection Failed">
                  {state.notice ?? "The last linking attempt could not be completed."}
                </Alert>
                <div className="mt-auto pt-2">
                  <ButtonLink href="/connect-bank" variant="secondary" className="self-start text-danger">
                    <RefreshCw aria-hidden className="size-4 shrink-0" />
                    Retry linking
                  </ButtonLink>
                </div>
              </div>
            ) : null}

            {status === "linking_in_progress" ? (
              <div className="flex flex-1 flex-col gap-3">
                <Alert tone="info" title="Linking in Progress">
                  A banking provider handshake is currently awaiting confirmation.
                </Alert>
                <div className="mt-auto pt-2">
                  <ButtonLink href="/connect-bank" variant="secondary" className="self-start text-info">
                    Continue linking
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </ButtonLink>
                </div>
              </div>
            ) : null}
          </Card>
        </Reveal>

        {/* Trip Preferences Section */}
        <Reveal order={1}>
          <Card aria-labelledby="trip-heading" className="flex h-full flex-col gap-4">
            <SectionHeader id="trip-heading" title="Trip preferences" />
            {preferences ? (
              <dl className="grid gap-3 text-sm">
                <Row term="Home country">{getCountry(preferences.homeCountry).name}</Row>
                <Row term="Destinations">{preferences.destinations.map((code) => getCountry(code).name).join(", ")}</Row>
                <Row term="Display currency">
                  {preferences.displayCurrency} · {getCurrency(preferences.displayCurrency).name}
                </Row>
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">You haven&rsquo;t set up a trip yet.</p>
            )}
            <p className="text-[13px] text-ink-muted">Preferences aren&rsquo;t saved yet, so refreshing the page clears them.</p>
            <ButtonLink href="/onboarding" variant="secondary" className="mt-auto self-start">
              {preferences ? "Change preferences" : "Set up your trip"}
            </ButtonLink>
          </Card>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Demo State Switcher */}
        <Reveal order={2}>
          <BankStateSwitcher />
        </Reveal>

        {/* About this Demo */}
        <Reveal order={3}>
          <Card aria-labelledby="demo-heading" className="flex h-full flex-col gap-4">
            <SectionHeader id="demo-heading" title="About this demo" />
            <Alert tone="warning" title="Demo mode">
              PayPal Sandbox is used. No real money will move.
            </Alert>
            <p className="text-sm text-ink-muted">
              Currency conversions are estimates, not guaranteed final rates. The rates shown today are fixed sample values,
              not market data. Bank linking is simulated for this frontend milestone; no actual banking credentials are stored.
            </p>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-ink-subtle">{term}</dt>
      <dd className="min-w-0 font-medium text-ink">{children}</dd>
    </div>
  );
}
