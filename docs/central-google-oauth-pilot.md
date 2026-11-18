# Central Google OAuth: Learning Dev pilot

Learning Dev keeps its existing `/api/auth/*` proxy. Google returns to Krakstack Auth, which sends the browser back to Learning Dev with a 45-second code. The project proxy can redeem that code only with the browser cookie from the original sign-in and the same active project registration. The session cookie is set on the project response, not sent in the URL.

## Enable the pilot

1. Confirm `learning-dev.kokobi.org` has one active domain registration for the Learning Dev project, Google sign-in is enabled, and the existing proxy has a service key authorized for that project and origin.
2. In the Krakstack Google OAuth client, add `https://auth.krakstack.net/api/auth/callback/google` as an authorized redirect URI. Keep any existing redirect URIs while they are still in use.
3. Deploy Auth with migration 7 and `BETTER_AUTH_URL=https://auth.krakstack.net`. Once all replicas are running the new code, set `PROJECT_GOOGLE_OAUTH_ORIGINS=https://learning-dev.kokobi.org`.
4. Test from a fresh browser session: start sign-in on Learning Dev, complete Google sign-in, and confirm the browser returns to Learning Dev signed in. Check that cancellation returns to the Learning Dev sign-in page and that an origin not on the pilot list still uses its old callback.

No SDK upgrade is needed. Don't log query strings on `/api/auth/project-oauth/*` or OAuth callback requests.

## Roll back

Clear `PROJECT_GOOGLE_OAUTH_ORIGINS` on all Auth replicas. New sign-ins use the previous per-host callback; sign-ins already in flight must restart. Leave the additive migration in place.

Additional project origins can be enabled without adding Google redirect URIs. This flow does not synchronize sessions across unrelated domains.

## Test the shared company SSO callback locally

Run Auth with `PROJECT_SSO_OAUTH_ORIGINS=http://localhost:3000` and `BETTER_AUTH_URL=http://localhost:3001`. In Learning's organization SSO settings, verify the displayed URL is `http://localhost:3001/api/auth/sso/callback`. Register that exact URI on the organization's OIDC client, not the Learning hostname. If you also test Google social sign-in, keep its separate `/api/auth/callback/google` URI on the social OAuth client.

Start company SSO from Learning and sign in as an existing verified organization member. The provider returns to port 3001; Learning establishes the session on port 3000. Clear `PROJECT_SSO_OAUTH_ORIGINS` to return to per-host SSO callbacks. Keep any legacy URI still used by another app.
