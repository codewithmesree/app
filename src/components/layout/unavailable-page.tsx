import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type UnavailablePageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

/** Honest placeholder for destinations that later milestones will build. */
export function UnavailablePage({ title, description, icon }: UnavailablePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <Reveal>
        <Card>
          <EmptyState
            icon={icon}
            title="Not available in this prototype yet"
            description="This screen is planned but hasn't been built, so nothing here can start or change a payment."
            action={
              <ButtonLink href="/dashboard" variant="secondary">
                Back to dashboard
              </ButtonLink>
            }
          />
        </Card>
      </Reveal>
    </div>
  );
}
