# Central callbacks for project sign-in

Learning Dev keeps its existing `/api/auth/*` proxy. Google returns to Krakstack Auth, which sends the browser back to Learning Dev with a 45-second code. The project proxy can redeem that code only with the browser cookie from the original sign-in and the same active project registration. The session cookie is set on the project response, not sent in the URL.

## Google

1. Confirm `learning-dev.kokobi.org` has one active domain registration for the Learning Dev project, Google sign-in is enabled, and the existing proxy has a service key authorized for that project and origin.
2. In the Krakstack Google OAuth client, add `https://auth.krakstack.net/api/auth/callback/google` as an authorized redirect URI. Keep any existing redirect URIs while they are still in use.
3. Deploy Auth with `BETTER_AUTH_URL=https://auth.krakstack.net`. Interactive Google sign-in through an authenticated project proxy uses the central callback automatically. No per-host environment list is required.
4. Test from a fresh browser session: complete Google sign-in and confirm the browser returns to Learning Dev signed in. Check that cancellation returns to the Learning Dev sign-in page.

No SDK upgrade is needed. Don't log query strings on `/api/auth/project-oauth/*` or OAuth callback requests.

## Organization SSO

All connections use `https://auth.krakstack.net/api/auth/sso/callback`. Register that exact URL on the organization's IdP client. There is no callback to register for each project. If an IdP client was configured before the switch, update its redirect URI before testing sign-in.

## Local testing

Run Auth with `BETTER_AUTH_URL=http://localhost:3001` and Learning on the registered `http://localhost:3000` origin. Use `http://localhost:3001/api/auth/sso/callback` for a shared SSO connection and `http://localhost:3001/api/auth/callback/google` for social Google sign-in. The provider returns to port 3001; Learning establishes the session on port 3000.
