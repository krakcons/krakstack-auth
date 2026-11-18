import { createHash, randomBytes } from "node:crypto";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { Effect, Option, Schema } from "effect";
import { runWithDatabase } from "@/services/database";
import { registeredAuthDomainForRequest } from "@/services/domains";
import { SignInSsoPayload } from "@krak-stack/auth/auth";
import { createAuth, type Auth } from "../config";
import { centralOAuthOrigin, projectOAuthOrigins, sharedSsoPath, supportsProjectOAuthOrigin } from "./policy";
import { Flow, GoogleStart, ProviderOptions, ProviderRedirect } from "./schema";
import { ProjectOAuthStore } from "./store";

const prefix = "/api/auth/project-oauth";
const googleStartPath = `${prefix}/google`;
const ssoStartPath = `${prefix}/sso`;
const redeemPath = `${prefix}/redeem`;
const successPath = `${prefix}/complete`;
const googleCallbackPath = "/api/auth/callback/google";
const googleSignInPath = "/api/auth/sign-in/social";
const ssoSignInPath = "/api/auth/sign-in/sso";
const browserCookie = "__Host-krakstack-project-oauth";

const randomSecret = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)).annotate({
  identifier: "ProjectOAuthSecret",
});
const decodeSecret = Schema.decodeUnknownOption(secret);
const tryGoogleStart = Schema.decodeUnknownOption(Schema.fromJsonString(GoogleStart));
const trySsoStart = Schema.decodeUnknownOption(Schema.fromJsonString(SignInSsoPayload), {
  onExcessProperty: "error",
});
const tryProviderRedirect = Schema.decodeUnknownOption(Schema.fromJsonString(ProviderRedirect));
const decodeURL = Schema.decodeUnknownOption(Schema.URLFromString);

const respond = (status: number, location?: string, cookies: string[] = []) => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  if (location) headers.set("Location", location);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status, headers });
};

const jsonStart = (url: string, cookie: string) =>
  Response.json(
    { url, redirect: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Set-Cookie": cookie,
      },
    },
  );

const bindingCookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const cookieValue = (request: Request, name: string) => {
  const values = request.headers.get("cookie")?.split(/;\s*/);
  return values?.find((cookie) => cookie.startsWith(`${name}=`))?.slice(name.length + 1);
};

const cookieFromResponse = (response: Response, name: string) =>
  response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));

const cookiePair = (cookie: string) => cookie.split(";", 1)[0] ?? "";

// Return URLs are never taken from the OAuth callback or redemption request.
const projectDestination = (value: string, origin: string) => {
  const url = Option.getOrNull(decodeURL(value.startsWith("/") ? `${origin}${value}` : value));
  return url?.origin === origin &&
    !url.username &&
    !url.password &&
    !url.pathname.startsWith("/api/auth/")
    ? url
    : null;
};

const runStore = <A, E>(effect: Effect.Effect<A, E, ProjectOAuthStore>) =>
  runWithDatabase(effect.pipe(Effect.provide(ProjectOAuthStore.layer)));

const failure = (flow: typeof Flow.Type, cookies: string[] = []) => {
  const url = new URL(flow.errorDestination);
  url.searchParams.set("error", "oauth_sign_in_failed");
  return respond(303, url.href, cookies);
};

const isCurrentDomain = async (flow: typeof Flow.Type) => {
  const domain = await registeredAuthDomainForRequest(new Request(flow.projectOrigin));
  return domain?.id === flow.domainId && domain.projectId === flow.projectId;
};

const centralAuth = (origin: string, projectId: string, sharedSsoRedirectURI?: string) =>
  createAuth({ allowedHosts: [new URL(origin).host], fixedBaseURL: origin, projectId, sharedSsoRedirectURI });

// Called only after BetterAuthRequest authenticates the project proxy and
// discards all browser-provided forwarding headers.
export const handleProjectOAuth = async (
  request: Request,
  projectAuth: Auth,
  authForFlow = centralAuth,
): Promise<Response | undefined> => {
  const url = new URL(request.url);
  const central = centralOAuthOrigin();
  const googleOrigins = projectOAuthOrigins("google");
  const ssoOrigins = projectOAuthOrigins("sso");
  if (!central || (!googleOrigins.length && !ssoOrigins.length)) {
    return url.pathname.startsWith(`${prefix}/`) ? respond(404) : undefined;
  }

  const host = request.headers.get("x-forwarded-host");
  const protocol = request.headers.get("x-forwarded-proto");
  const proxyUrl = host && protocol ? Option.getOrNull(decodeURL(`${protocol}://${host}`)) : null;
  const projectOrigin = proxyUrl && supportsProjectOAuthOrigin(proxyUrl) ? proxyUrl.origin : null;
  const onCentralHost = !host && url.host === central.host;
  const isSsoSignIn = url.pathname === ssoSignInPath;
  const sharedRedirect = new URL(sharedSsoPath, central).href;

  if (
    (url.pathname === googleSignInPath || isSsoSignIn) &&
    request.method === "POST" &&
    projectOrigin &&
    projectOrigin !== central.origin &&
    (isSsoSignIn ? ssoOrigins : googleOrigins).includes(projectOrigin)
  ) {
    if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json")
      return isSsoSignIn ? respond(415) : undefined;
    const bodyText = await request.clone().text();
    const sso = isSsoSignIn ? Option.getOrNull(trySsoStart(bodyText)) : null;
    const google = isSsoSignIn ? null : Option.getOrNull(tryGoogleStart(bodyText));
    // Native token sign-in and Krakstack's own OAuth authorization flow are
    // separate entry points. Only the project's interactive Google login moves.
    if (isSsoSignIn && !sso) return respond(400);
    if (!isSsoSignIn && (!google ||
      google.idToken !== undefined ||
      google.oauth_query !== undefined ||
      google.additionalData !== undefined ||
      google.scopes !== undefined ||
      google.newUserCallbackURL !== undefined))
      return undefined;
    if (request.headers.get("origin") !== projectOrigin) return respond(403);

    const body = sso ?? google;
    const destination = projectDestination(body?.callbackURL ?? "/", projectOrigin);
    const errorDestination = projectDestination(body?.errorCallbackURL ?? "/sign-in", projectOrigin);
    if (!destination || !errorDestination) return respond(400);
    const domain = await registeredAuthDomainForRequest(request);
    const projectId = domain?.projectId;
    if (!domain || !projectId) return respond(403);

    const browser = Option.getOrElse(
      decodeSecret(cookieValue(request, browserCookie)),
      randomSecret,
    );
    const id = randomSecret();
    const providerOptions = sso ? { providerId: sso.providerId } :
      Schema.decodeUnknownSync(ProviderOptions)(google);
    await runStore(
      ProjectOAuthStore.use((store) =>
        store.create({
          id,
          domainId: domain.id,
          projectId,
          projectOrigin,
          browserHash: hash(browser),
          destination: destination.href,
          errorDestination: errorDestination.href,
          providerOptions,
        }),
      ),
    );
    const start = new URL(sso ? ssoStartPath : googleStartPath, central);
    start.searchParams.set("flow", id);
    return jsonStart(start.href, bindingCookie(browserCookie, browser, 480));
  }

  if ((url.pathname === googleStartPath || url.pathname === ssoStartPath) &&
      onCentralHost && request.method === "GET") {
    const id = Option.getOrNull(decodeSecret(url.searchParams.get("flow")));
    if (!id) return respond(400);
    const flow = Option.getOrNull(
      await runStore(ProjectOAuthStore.use((store) => store.claimStart(id))),
    );
    const providerId = flow?.providerOptions.providerId;
    if (!flow || (url.pathname === ssoStartPath) !== Boolean(providerId) ||
        !(providerId ? ssoOrigins : googleOrigins).includes(flow.projectOrigin) ||
        !(await isCurrentDomain(flow))) {
      return respond(403);
    }
    const auth = authForFlow(central.origin, flow.projectId, providerId ? sharedRedirect : undefined);
    const destination = new URL(successPath, central).href;
    const result = await auth.handler(
      new Request(new URL(providerId ? ssoSignInPath : googleSignInPath, central), {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: central.origin },
        body: JSON.stringify(providerId ? { providerId, callbackURL: destination } : {
          provider: "google",
          ...flow.providerOptions,
          callbackURL: destination,
          disableRedirect: true,
        }),
      }),
    );
    if (!result.ok) return failure(flow);
    const authorization = Option.getOrNull(tryProviderRedirect(await result.text()))?.url;
    const state = authorization?.searchParams.get("state");
    const context = await auth.$context;
    const stateName = context.createAuthCookie("state").name;
    const stateCookie = cookieFromResponse(result, stateName);
    if (
      !authorization ||
      (providerId ? authorization.protocol !== "https:" : authorization.origin !== "https://accounts.google.com") ||
      authorization.searchParams.get("redirect_uri") !==
        (providerId ? sharedRedirect : new URL(googleCallbackPath, central).href) ||
      !state ||
      !stateCookie
    )
      return failure(flow);

    // Better Auth still verifies its signed state and PKCE. Per-flow host-only
    // cookies keep the central redirect isolated from native OAuth and other tabs.
    const stateValue = cookiePair(stateCookie).slice(stateName.length + 1);
    if (
      Option.isNone(
        await runStore(
          ProjectOAuthStore.use((store) =>
            store.bindState({ id, stateHash: hash(state), stateCookieHash: hash(stateValue) }),
          ),
        ),
      )
    )
      return failure(flow);
    return respond(303, authorization.href, [
      bindingCookie(`${browserCookie}-${id}`, stateValue, 300),
    ]);
  }

  if ((url.pathname === googleCallbackPath || url.pathname === sharedSsoPath) &&
      onCentralHost && request.method === "GET") {
    const state = url.searchParams.get("state");
    if (!state) return url.pathname === sharedSsoPath ? respond(400) : undefined;
    const flow = Option.getOrNull(
      await runStore(ProjectOAuthStore.use((store) => store.findCallback(hash(state)))),
    );
    if (!flow) return url.pathname === sharedSsoPath ? respond(403) : undefined;
    const providerId = flow.providerOptions.providerId;
    const name = `${browserCookie}-${flow.id}`;
    const stateValue = cookieValue(request, name);
    if (!stateValue || (url.pathname === sharedSsoPath) !== Boolean(providerId) ||
        !(providerId ? ssoOrigins : googleOrigins).includes(flow.projectOrigin) ||
        !(await isCurrentDomain(flow))) {
      return respond(403);
    }
    if (
      Option.isNone(
        await runStore(
          ProjectOAuthStore.use((store) =>
            store.claimCallback({ id: flow.id, stateCookieHash: hash(stateValue) }),
          ),
        ),
      )
    )
      return respond(403);

    const auth = authForFlow(central.origin, flow.projectId, providerId ? sharedRedirect : undefined);
    const context = await auth.$context;
    const stateName = context.createAuthCookie("state").name;
    const callback = new URL(url.pathname, central);
    callback.search = url.search;
    const result = await auth.handler(
      new Request(callback, {
        headers: { Cookie: `${stateName}=${stateValue}` },
      }),
    );
    const clearState = [bindingCookie(name, "", 0)];
    const sessionCookie = cookieFromResponse(result, context.authCookies.sessionToken.name);
    if (
      !sessionCookie ||
      result.status !== 302 ||
      result.headers.get("location") !== new URL(successPath, central).href
    ) {
      return failure(flow, clearState);
    }
    const code = randomSecret();
    const encrypted = await symmetricEncrypt({ key: context.secretConfig, data: sessionCookie });
    const completed = await runStore(
      ProjectOAuthStore.use((store) =>
        store.complete({ id: flow.id, codeHash: hash(code), sessionCookie: encrypted }),
      ),
    );
    if (Option.isNone(completed)) return failure(flow, clearState);
    const redeem = new URL(redeemPath, flow.projectOrigin);
    redeem.searchParams.set("code", code);
    return respond(303, redeem.href, clearState);
  }

  if (
    url.pathname === redeemPath &&
    projectOrigin &&
    request.method === "GET" &&
    (googleOrigins.includes(projectOrigin) || ssoOrigins.includes(projectOrigin))
  ) {
    const code = Option.getOrNull(decodeSecret(url.searchParams.get("code")));
    const browser = Option.getOrNull(decodeSecret(cookieValue(request, browserCookie)));
    if (!code || !browser) return respond(403);
    const domain = await registeredAuthDomainForRequest(request);
    const projectId = domain?.projectId;
    if (!domain || !projectId) return respond(403);
    const redeemed = Option.getOrNull(
      await runStore(
        ProjectOAuthStore.use((store) =>
          store.redeem({
            codeHash: hash(code),
            browserHash: hash(browser),
            projectOrigin,
            projectId,
            domainId: domain.id,
            googleEnabled: googleOrigins.includes(projectOrigin),
            ssoEnabled: ssoOrigins.includes(projectOrigin),
          }),
        ),
      ),
    );
    if (!redeemed) return respond(403);

    const context = await projectAuth.$context;
    const cookie = await symmetricDecrypt({
      key: context.secretConfig,
      data: redeemed.sessionCookie,
    });
    if (!cookie.startsWith(`${context.authCookies.sessionToken.name}=`)) return respond(403);
    // The project proxy applies its normal cookie-domain policy. Never expose
    // the central domain attribute or any provider cookies to the project.
    return respond(303, redeemed.destination, [cookie.replace(/;\s*domain=[^;]*/gi, "")]);
  }
  return url.pathname.startsWith(`${prefix}/`) ? respond(404) : undefined;
};
