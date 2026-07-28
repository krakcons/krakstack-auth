import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import {
  BookOpen,
  Boxes,
  Code2,
  ExternalLink,
  Globe2,
  House,
  KeyRound,
  Network,
  Paintbrush,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";
import { Suspense, type ReactNode, useState } from "react";
import {
  OrganizationSwitcher,
  ResetPassword,
  Signin,
  Signup,
  TwoFactor,
  UserButton,
  VerifyEmail,
  type OrganizationSwitcherFeatures,
} from "@krak-stack/auth";

import { ThemeToggle } from "@/components/theme-toggle";
import { AppBrand } from "@/components/ui/app-brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { SidebarLayout, type NavGroup } from "@/components/ui/sidebar-layout";
import { getDocsPage, getLocalizedDocsPages } from "@/lib/docs";
import { authBaseUrl, authClient } from "@/services/auth/client";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const iconForName = (name: string) => {
  switch (name) {
    case "boxes":
      return Boxes;
    case "globe":
      return Globe2;
    case "key":
      return KeyRound;
    case "network":
      return Network;
    case "paintbrush":
      return Paintbrush;
    case "server":
      return ServerCog;
    case "shield":
      return ShieldCheck;
    default:
      return BookOpen;
  }
};

const docsLocale = () => (getLocale() === "fr" ? "fr" : "en");

export const Route = createFileRoute("/docs/{-$slug}")({
  loader: ({ params }) => {
    const page = getDocsPage(params.slug ?? "introduction", docsLocale());
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Documentation"} | Krakstack Auth` },
      {
        name: "description",
        content: loaderData?.description ?? "Krakstack Auth documentation",
      },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const page = Route.useLoaderData();
  const locale = docsLocale();
  const pages = getLocalizedDocsPages(locale);
  const pageItem = (item: (typeof pages)[number]) => ({
    label: () => item.title,
    href: item.path,
    icon: iconForName(item.icon),
  });
  const pagesFor = (slugs: ReadonlySet<string>) =>
    pages.filter((item) => slugs.has(item.slug)).map(pageItem);
  const groups: NavGroup[] = [
    {
      label: () => (locale === "fr" ? "Aperçu" : "Overview"),
      items: pagesFor(new Set(["introduction", "setup"])),
    },
    {
      label: () => (locale === "fr" ? "Intégration" : "Integration"),
      items: pagesFor(new Set(["proxy", "oauth", "subdomain"])),
    },
    {
      label: () => (locale === "fr" ? "Interface" : "Frontend"),
      items: pagesFor(new Set(["components", "auth-pages"])),
    },
    {
      label: () => (locale === "fr" ? "Serveur" : "Backend"),
      items: pagesFor(new Set(["middleware", "domains"])),
    },
    {
      label: () => (locale === "fr" ? "Exploitation" : "Operations"),
      items: pagesFor(new Set(["self-hosting", "security"])),
    },
    {
      label: () => (locale === "fr" ? "Ressources" : "Resources"),
      items: [
        {
          label: () => (locale === "fr" ? "Accueil" : "Home"),
          href: "/",
          icon: House,
        },
        {
          label: () => "GitHub",
          href: "https://github.com/krakcons/krakstack-auth",
          icon: Code2,
          external: true,
        },
      ],
    },
  ];

  return (
    <SidebarLayout
      groups={groups}
      sidebarHeader={
        <AppBrand
          label="Krakstack"
          subtitle="Auth Docs"
          icon={BookOpen}
          href="/"
          variant="sidebar"
        />
      }
      headerActions={
        <>
          <a
            className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-sm sm:flex"
            href="https://github.com/krakcons/krakstack-auth"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ExternalLink className="size-3.5" />
          </a>
          <ThemeToggle />
          <LocaleSwitcher />
        </>
      }
    >
      <main className="mx-auto w-full max-w-4xl pb-16">
        <div className="mb-8 border-b pb-8">
          <p className="text-primary mb-3 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
            {locale === "fr" ? "Guide Krakstack Auth" : "Krakstack Auth guide"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {page.title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
            {page.description}
          </p>
        </div>
        <Streamdown
          className="[&_a:hover]:text-primary [&_a]:underline-offset-4 [&_h1:first-child]:hidden [&_pre]:border [&_table]:text-sm"
          mode="static"
          plugins={{ code }}
        >
          {page.source}
        </Streamdown>
        {page.slug === "components" ? (
          <ClientOnly
            fallback={
              <Card className="mt-12">
                <CardContent className="text-muted-foreground text-sm">
                  {m.docs_component_previews_loading()}
                </CardContent>
              </Card>
            }
          >
            <ComponentPreviews />
          </ClientOnly>
        ) : null}
      </main>
    </SidebarLayout>
  );
}

function ComponentPreviews() {
  const locale = docsLocale();

  return (
    <section className="mt-16 border-t pt-10">
      <div className="mb-8">
        <p className="text-primary mb-2 font-mono text-xs font-semibold tracking-[0.16em] uppercase">
          {m.docs_component_previews_eyebrow()}
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          {m.docs_component_previews_title()}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-7">
          {m.docs_component_previews_description()}
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <OrganizationSwitcherPreview />
        <UserButtonPreview />
      </div>
      <div className="mt-12">
        <h3 className="mb-5 text-xl font-semibold tracking-tight">
          {m.docs_component_previews_auth_forms()}
        </h3>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <AuthFormPreview title="Signin">
            <Signin
              authClient={authClient}
              baseUrl={authBaseUrl}
              locale={locale}
            />
          </AuthFormPreview>
          <AuthFormPreview title="Signup">
            <Signup
              authClient={authClient}
              baseUrl={authBaseUrl}
              locale={locale}
            />
          </AuthFormPreview>
          <AuthFormPreview title="VerifyEmail">
            <VerifyEmail
              authClient={authClient}
              baseUrl={authBaseUrl}
              locale={locale}
            />
          </AuthFormPreview>
          <AuthFormPreview title="ResetPassword">
            <ResetPassword
              authClient={authClient}
              baseUrl={authBaseUrl}
              locale={locale}
            />
          </AuthFormPreview>
          <AuthFormPreview title="TwoFactor">
            <TwoFactor
              authClient={authClient}
              baseUrl={authBaseUrl}
              locale={locale}
            />
          </AuthFormPreview>
        </div>
      </div>
    </section>
  );
}

function OrganizationSwitcherPreview() {
  const [features, setFeatures] = useState<OrganizationSwitcherFeatures>({
    organizationCreation: true,
    organizationSwitching: true,
    userInvitations: true,
  });
  const featureOptions = [
    {
      key: "organizationSwitching",
      label: m.docs_organization_switcher_feature_switching(),
    },
    {
      key: "organizationCreation",
      label: m.docs_organization_switcher_feature_creation(),
    },
    {
      key: "userInvitations",
      label: m.docs_organization_switcher_feature_invitations(),
    },
  ] as const;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{m.docs_organization_switcher_preview_title()}</CardTitle>
        <CardDescription>
          {m.docs_organization_switcher_preview_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <div className="bg-muted/40 flex min-h-40 items-center justify-center rounded-lg border border-dashed p-6">
          <div className="w-full max-w-72">
            <OrganizationSwitcher
              authClient={authClient}
              baseUrl={authBaseUrl}
              features={features}
              renderUnauthenticated={() => (
                <p className="text-muted-foreground text-center text-sm leading-6">
                  {m.docs_organization_switcher_preview_signed_out()}
                </p>
              )}
            />
          </div>
        </div>
        <fieldset className="flex flex-col justify-center gap-4">
          <legend className="mb-1 text-sm font-semibold">
            {m.docs_organization_switcher_preview_features()}
          </legend>
          {featureOptions.map(({ key, label }) => (
            <div className="flex items-center gap-2" key={key}>
              <Checkbox
                id={`organization-switcher-${key}`}
                checked={features[key]}
                onCheckedChange={(checked) =>
                  setFeatures((current) => ({
                    ...current,
                    [key]: checked,
                  }))
                }
              />
              <FieldLabel htmlFor={`organization-switcher-${key}`}>
                {label}
              </FieldLabel>
            </div>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}

function UserButtonPreview() {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>UserButton</CardTitle>
        <CardDescription>
          {m.docs_user_button_preview_description()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/40 flex min-h-40 items-center justify-center rounded-lg border border-dashed p-6">
          <div className="w-full max-w-72">
            <UserButton
              authClient={authClient}
              baseUrl={authBaseUrl}
              renderUnauthenticated={() => (
                <p className="text-muted-foreground text-center text-sm leading-6">
                  {m.docs_user_button_preview_signed_out()}
                </p>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthFormPreview({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 font-mono text-xs font-semibold">
        {title}
      </p>
      <div className="bg-muted/40 flex min-h-48 justify-center rounded-xl border border-dashed p-4 sm:p-6">
        <Suspense
          fallback={
            <p className="text-muted-foreground self-center text-sm">
              {m.docs_component_preview_loading()}
            </p>
          }
        >
          {children}
        </Suspense>
      </div>
    </div>
  );
}
