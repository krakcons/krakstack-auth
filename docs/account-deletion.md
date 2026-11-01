# Account deletion and project webhooks

[Français](account-deletion.fr.md)

## Current behavior

The user menu offers full account deletion through Better Auth's native
`/api/auth/delete-user` endpoint. A five-minute fresh session or password is
required. Platform administrators, organization owners, and impersonated sessions
cannot self-delete; transfer ownership/admin roles first. Selective project
deletion is not implemented.

Before Better Auth removes the identity, Auth persists connected-project routing
events. Better Auth owns user, credential, and session deletion. Auth also removes
user API keys and associated verification records. Organizations and OAuth clients
survive with a null creator reference. The durable subscriber checks that the
user is gone before publishing `user.deletion_requested` to each project's webhook.
Delivery failures do not restore the central identity; they retry independently.

## Project setup

Set the project's **Webhook URL** to its HTTPS `/api/webhooks/auth` endpoint. Copy
the **Signing secret** to server-only `KRAKSTACK_AUTH_WEBHOOK_SECRET` on the receiver.
Use `AuthMiddleware.layer({ onDeleteUser })` with the same SQL pool as cleanup.
Only `onDeleteUser` is required; optional `onWebhook` handles future event types.
The endpoint accepts all published project Auth event types, but only deletion is
currently published by this flow. It does not forward every internal audit event.

See [the SDK receiver contract](../packages/sdk/README.md#auth-webhooks-development)
for signatures, transactions, deduplication, and error responses. Kokobi Learning
is the first receiver. Existing `AuthAccountDeletionV1` endpoint settings are
recognized; saving upgrades them to `AuthProjectWebhooksV1` without changing the secret.

## Local webhook testing

With Auth running through `bun run dev` in Vite's `development` mode, register
`http://localhost:3000/api/webhooks/auth` (replace the port with the receiver's
port). The development sender explicitly enables loopback delivery; no tunnel,
Vite host exception, or authentication origin change is needed. Copy the signing
secret to the receiver and restart it as usual. Only `localhost`, `127.0.0.1`,
and `[::1]` are allowed by this exception, not LAN or metadata addresses.
Production builds disable the exception, including delivery to previously saved
local endpoints. Test with a disposable account, never a real account.

## Workflow runners and rollout

- Default `AUTH_WORKFLOW_RUNNER=single`: run one Auth executor per database.
- Multi-instance: set `AUTH_WORKFLOW_RUNNER=http` on every instance, with a unique
  privately reachable `AUTH_WORKFLOW_HOST` (or `POD_IP`).
- `AUTH_WORKFLOW_PORT` defaults to `34431`; permit private runner-to-runner traffic.
  The listener binds `0.0.0.0`. Do not expose it publicly.
- Both modes use SQL-backed workflow/message storage. Stop and drain all old
  executors before changing topology. Never overlap single and HTTP runners on
  the same storage, including during rollback. Restart all instances in the
  chosen topology; unfinished durable work resumes from SQL.
- Apply database migrations before serving. Start workflow registration before
  accepting requests. Termination drains HTTP and disposes the shared runtime.

See [KrakStack HTTP runners](https://krakstack.net/en/docs/workflow-layer#http-recommended).
Current package dependencies use ignored local tarballs; publish and replace
those paths before CI/deployment. Nothing has been published or deployed here.

## Limits

Deletion is not proof of privacy-law compliance or complete erasure. Historical
Events, email invitations, exports, telemetry/processors, backups, and external
copies require retention/erasure policies. Receivers must inventory all local
personal data and prevent in-flight work from reintroducing it. Schedule receipt
cleanup explicitly after 30 days and keep handlers idempotent after expiry.
