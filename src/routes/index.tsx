import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Blocks,
  Building2,
  Check,
  Fingerprint,
  Globe2,
  KeyRound,
  Menu,
  Network,
  Paintbrush,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { AppBrand } from "@/components/ui/app-brand";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/")({
  component: Home,
});

const methods = [
  {
    title: m.home_method_proxy,
    description: m.home_method_proxy_description,
    slug: "proxy",
    icon: Network,
    recommended: true,
    marker: "01",
  },
  {
    title: m.home_method_oauth,
    description: m.home_method_oauth_description,
    slug: "oauth",
    icon: KeyRound,
    marker: "02",
  },
  {
    title: m.home_method_domain,
    description: m.home_method_domain_description,
    slug: "subdomain",
    icon: Globe2,
    marker: "03",
  },
];

const features = [
  {
    title: m.home_feature_sessions,
    description: m.home_feature_sessions_description,
    icon: ShieldCheck,
  },
  {
    title: m.home_feature_orgs,
    description: m.home_feature_orgs_description,
    icon: Building2,
  },
  {
    title: m.home_feature_branding,
    description: m.home_feature_branding_description,
    icon: Paintbrush,
  },
  {
    title: m.home_feature_service,
    description: m.home_feature_service_description,
    icon: ServerCog,
  },
];

function Home() {
  return (
    <div className="min-h-screen overflow-hidden">
      <header className="bg-background/90 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <AppBrand
            label={m.sidebar_brand()}
            subtitle={m.sidebar_brand_subtitle()}
            icon={Fingerprint}
            className="min-w-0"
          />
          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm">
            <Link
              className="text-muted-foreground hover:text-foreground hidden px-2 transition-colors md:inline-flex"
              to="/docs/{-$slug}"
              params={{ slug: undefined }}
            >
              {m.home_view_docs()}
            </Link>
            <a
              className="text-muted-foreground hover:text-foreground hidden px-2 transition-colors md:inline-flex"
              href="https://github.com/krakcons/krakstack-auth"
              target="_blank"
              rel="noreferrer"
            >
              {m.home_github()}
            </a>
            <MobileHeaderMenu />
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </nav>
      </header>

      <main>
        <section className="relative border-b">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_38%,color-mix(in_oklab,var(--secondary)_32%,transparent),transparent_32%)]" />
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:48px_48px] opacity-[0.035]" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-32">
            <div>
              <div className="text-primary mb-6 flex items-center gap-3 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
                <span className="bg-primary h-px w-8" />
                {m.home_eyebrow()}
              </div>
              <h1 className="max-w-4xl text-5xl leading-[1.02] font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                {m.home_heading()}
              </h1>
              <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-8 sm:text-xl">
                {m.home_description()}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  className={buttonVariants({ size: "lg" })}
                  to="/docs/{-$slug}"
                  params={{ slug: "setup" }}
                >
                  {m.home_view_docs()}
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                  href="https://github.com/krakcons/krakstack-auth"
                  target="_blank"
                  rel="noreferrer"
                >
                  {m.home_github()}
                </a>
              </div>
            </div>

            <AuthPreview />
          </div>
        </section>

        <section className="border-b">
          <div className="mx-auto grid max-w-7xl divide-y px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0">
            <Stat
              title={m.home_stat_protocol()}
              detail={m.home_stat_protocol_detail()}
            />
            <Stat
              title={m.home_stat_deploy()}
              detail={m.home_stat_deploy_detail()}
            />
            <Stat title={m.home_stat_ui()} detail={m.home_stat_ui_detail()} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading
            kicker={m.home_methods_kicker()}
            title={m.home_methods_title()}
            description={m.home_methods_description()}
          />
          <div className="bg-border mt-12 grid gap-px overflow-hidden rounded-xl border lg:grid-cols-3">
            {methods.map((method) => (
              <Link
                className="group bg-background hover:bg-muted/50 relative flex min-h-72 flex-col p-7 transition-colors"
                to="/docs/{-$slug}"
                params={{ slug: method.slug }}
                key={method.marker}
              >
                <div className="flex items-start justify-between">
                  <div className="bg-secondary text-secondary-foreground flex size-11 items-center justify-center rounded-lg">
                    <method.icon className="size-5" />
                  </div>
                  <span className="text-muted-foreground font-mono text-xs">
                    {method.marker}
                  </span>
                </div>
                <div className="mt-auto pt-10">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{method.title()}</h3>
                    {method.recommended ? (
                      <Badge variant="secondary">
                        {m.home_method_proxy_badge()}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-3 text-sm leading-6">
                    {method.description()}
                  </p>
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground mt-6 size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-foreground text-background">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-background/60 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
                {m.home_platform_kicker()}
              </p>
              <h2 className="mt-5 max-w-md text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                {m.home_platform_title()}
              </h2>
            </div>
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title()}>
                  <feature.icon className="text-secondary mb-5 size-6" />
                  <h3 className="font-semibold">{feature.title()}</h3>
                  <p className="text-background/65 mt-2 text-sm leading-6">
                    {feature.description()}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="bg-secondary text-secondary-foreground relative overflow-hidden rounded-2xl p-8 sm:p-12 lg:flex lg:items-end lg:justify-between">
            <Blocks className="absolute -top-10 -right-8 size-52 opacity-[0.07]" />
            <div className="relative max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {m.home_cta_title()}
              </h2>
              <p className="mt-4 max-w-xl leading-7 opacity-75">
                {m.home_cta_description()}
              </p>
            </div>
            <Link
              className={`${buttonVariants({ size: "lg" })} relative mt-8 lg:mt-0`}
              to="/docs/{-$slug}"
              params={{ slug: "self-hosting" }}
            >
              {m.home_get_started()}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{m.home_footer()}</span>
          <div className="flex gap-5">
            <Link
              className="hover:text-foreground"
              to="/docs/{-$slug}"
              params={{ slug: undefined }}
            >
              {m.home_view_docs()}
            </Link>
            <a
              className="hover:text-foreground"
              href="https://github.com/krakcons/krakstack-auth"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AuthPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
      <div className="bg-card shadow-foreground/10 overflow-hidden rounded-xl border shadow-2xl">
        <div className="bg-muted/60 flex h-11 items-center gap-2 border-b px-4">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <div className="bg-background text-muted-foreground ml-3 flex h-6 flex-1 items-center rounded border px-3 font-mono text-[10px]">
            auth.your-product.com/sign-in
          </div>
        </div>
        <div className="grid min-h-96 sm:grid-cols-[0.72fr_1.28fr]">
          <div className="bg-primary text-primary-foreground hidden flex-col justify-between p-6 sm:flex">
            <Fingerprint className="size-8" />
            <div>
              <div className="mb-3 flex gap-1">
                <span className="h-1 w-7 rounded-full bg-current" />
                <span className="h-1 w-3 rounded-full bg-current opacity-30" />
                <span className="h-1 w-3 rounded-full bg-current opacity-30" />
              </div>
              <p className="text-sm leading-6 opacity-80">
                One secure identity across every workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-9">
            <div className="bg-secondary text-secondary-foreground mb-6 flex size-10 items-center justify-center rounded-lg">
              <Users className="size-5" />
            </div>
            <div className="bg-foreground h-5 w-36 rounded" />
            <div className="bg-muted-foreground/25 mt-3 h-2.5 w-52 max-w-full rounded" />
            <div className="mt-7 space-y-3">
              <div className="h-10 rounded-md border" />
              <div className="h-10 rounded-md border" />
              <div className="bg-primary flex h-10 items-center justify-center rounded-md">
                <Check className="text-primary-foreground size-4" />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="bg-border h-px flex-1" />
              <span className="text-muted-foreground font-mono text-[9px] uppercase">
                OAuth
              </span>
              <span className="bg-border h-px flex-1" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="h-9 rounded-md border" />
              <div className="h-9 rounded-md border" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-secondary absolute -right-5 -bottom-5 -z-10 h-40 w-40 rounded-xl opacity-70" />
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.18em] uppercase">
          {kicker}
        </p>
        <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
      </div>
      <p className="text-muted-foreground max-w-xl text-base leading-7 lg:ml-auto">
        {description}
      </p>
    </div>
  );
}

function Stat({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center gap-4 px-2 py-7 md:px-8">
      <span className="bg-primary size-2 rounded-full" />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground mt-0.5 text-xs">{detail}</div>
      </div>
    </div>
  );
}

function MobileHeaderMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="size-4" />
            <span className="sr-only">{m.home_menu()}</span>
          </Button>
        }
      />
      <DropdownMenuContent
        className="w-72 max-w-[calc(100vw-1rem)]"
        align="end"
        sideOffset={8}
      >
        <div className="p-1">
          <DropdownMenuItem
            render={
              <Link to="/docs/{-$slug}" params={{ slug: undefined }}>
                {m.home_view_docs()}
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <a
                href="https://github.com/krakcons/krakstack-auth"
                target="_blank"
                rel="noreferrer"
              >
                {m.home_github()}
              </a>
            }
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
