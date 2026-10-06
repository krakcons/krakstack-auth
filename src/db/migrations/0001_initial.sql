-- Current schema from an isolated replay of the pre-handoff SQL.
-- Fresh databases only; existing databases must use db:adopt.
CREATE TABLE public.account (
 id text NOT NULL, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL,
 access_token text, refresh_token text, id_token text, access_token_expires_at timestamp,
 refresh_token_expires_at timestamp, scope text, password text,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp NOT NULL
);
CREATE TABLE public.apikey (
 id text NOT NULL, config_id text DEFAULT 'default' NOT NULL, name text, start text,
 reference_id text NOT NULL, prefix text, key text NOT NULL, refill_interval integer,
 refill_amount integer, last_refill_at timestamp, enabled boolean DEFAULT true,
 rate_limit_enabled boolean DEFAULT true, rate_limit_time_window integer DEFAULT 86400000,
 rate_limit_max integer DEFAULT 1000, request_count integer DEFAULT 0, remaining integer,
 last_request timestamp, expires_at timestamp, created_at timestamp NOT NULL,
 updated_at timestamp NOT NULL, permissions text, metadata text
);
CREATE TABLE public.domains (
 id text NOT NULL, hostname text NOT NULL, root_hostname text NOT NULL, project_id text,
 organization_id text, hostname_id text NOT NULL, active boolean DEFAULT false NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL,
 managed boolean DEFAULT true NOT NULL
);
CREATE TABLE public.invitation (
 id text NOT NULL, organization_id text NOT NULL, email text NOT NULL, role text,
 status text DEFAULT 'pending' NOT NULL, expires_at timestamp NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, inviter_id text NOT NULL
);
CREATE TABLE public.jwks (
 id text NOT NULL, public_key text NOT NULL, private_key text NOT NULL,
 created_at timestamp NOT NULL, expires_at timestamp, alg text, crv text
);
CREATE TABLE public.member (
 id text NOT NULL, organization_id text NOT NULL, user_id text NOT NULL,
 role text DEFAULT 'member' NOT NULL, created_at timestamp NOT NULL
);
CREATE TABLE public.oauth_access_token (
 id text NOT NULL, token text NOT NULL, client_id text NOT NULL, session_id text,
 user_id text, reference_id text, refresh_id text, expires_at timestamp NOT NULL,
 created_at timestamp NOT NULL, scopes text[] NOT NULL, authorization_code_id text,
 resources text[], requested_user_info_claims text[], revoked timestamp, confirmation jsonb
);
CREATE TABLE public.oauth_client (
 id text NOT NULL, client_id text NOT NULL, client_secret text, disabled boolean DEFAULT false,
 skip_consent boolean, enable_end_session boolean, subject_type text, scopes text[], user_id text,
 created_at timestamp, updated_at timestamp, name text, uri text, icon text, contacts text[],
 tos text, policy text, software_id text, software_version text, software_statement text,
 redirect_uris text[] NOT NULL, post_logout_redirect_uris text[], token_endpoint_auth_method text,
 grant_types text[], response_types text[], application_type text, require_pkce boolean,
 reference_id text, metadata jsonb, project_id text, client_discovery_id text,
 client_credentials_scopes text[] DEFAULT '{}'::text[], backchannel_logout_uri text,
 backchannel_logout_session_required boolean, jwks text, jwks_uri text,
 dpop_bound_access_tokens boolean DEFAULT false
);
CREATE TABLE public.oauth_client_assertion (id text NOT NULL, expires_at timestamp NOT NULL);
CREATE TABLE public.oauth_client_resource (
 id text NOT NULL, client_id text NOT NULL, resource_id text NOT NULL, metadata jsonb, created_at timestamp
);
CREATE TABLE public.oauth_consent (
 id text NOT NULL, client_id text NOT NULL, user_id text, reference_id text, scopes text[] NOT NULL,
 created_at timestamp NOT NULL, updated_at timestamp NOT NULL, resources text[], requested_user_info_claims text[]
);
CREATE TABLE public.oauth_refresh_token (
 id text NOT NULL, token text NOT NULL, client_id text NOT NULL, session_id text, user_id text NOT NULL,
 reference_id text, expires_at timestamp NOT NULL, created_at timestamp NOT NULL, revoked timestamp,
 auth_time timestamp, scopes text[] NOT NULL, authorization_code_id text, resources text[],
 requested_user_info_claims text[], rotated_at timestamp, rotation_replay_response text,
 rotation_replay_expires_at timestamp, confirmation jsonb
);
CREATE TABLE public.oauth_resource (
 id text NOT NULL, identifier text NOT NULL, name text NOT NULL, access_token_ttl integer,
 refresh_token_ttl integer, signing_algorithm text, signing_key_id text, allowed_scopes text[],
 custom_claims jsonb, dpop_bound_access_tokens_required boolean DEFAULT false,
 disabled boolean DEFAULT false, created_at timestamp, updated_at timestamp,
 policy_version integer DEFAULT 1, metadata jsonb
);
CREATE TABLE public.organization (
 id text NOT NULL, name text NOT NULL, slug text NOT NULL, logo text, created_at timestamp NOT NULL,
 metadata text, user_id text, parent_id text
);
CREATE TABLE public.project (
 id text NOT NULL, name text NOT NULL, logo text, data jsonb DEFAULT '{}' NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL
);
CREATE TABLE public.project_organization (
 id text NOT NULL, project_id text NOT NULL, organization_id text NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL
);
CREATE TABLE public.project_user (
 id text NOT NULL, project_id text NOT NULL, user_id text NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL
);
CREATE TABLE public.session (
 id text NOT NULL, expires_at timestamp NOT NULL, token text NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp NOT NULL,
 ip_address text, user_agent text, user_id text NOT NULL, impersonated_by text,
 active_organization_id text, impersonated_by_organization_id text
);
CREATE TABLE public.two_factor (
 id text NOT NULL, secret text NOT NULL, backup_codes text NOT NULL, user_id text NOT NULL,
 verified boolean DEFAULT true, failed_verification_count integer DEFAULT 0, locked_until timestamp
);
CREATE TABLE public."user" (
 id text NOT NULL, name text NOT NULL, email text NOT NULL, email_verified boolean DEFAULT false NOT NULL,
 image text, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL,
 role text, banned boolean DEFAULT false, ban_reason text, ban_expires timestamp,
 two_factor_enabled boolean DEFAULT false, last_login_method text, is_anonymous boolean DEFAULT false,
 metadata jsonb
);
CREATE TABLE public.verification (
 id text NOT NULL, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL,
 created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL
);
ALTER TABLE public.account ADD CONSTRAINT account_pkey PRIMARY KEY (id);
ALTER TABLE public.apikey ADD CONSTRAINT apikey_pkey PRIMARY KEY (id);
ALTER TABLE public.domains ADD CONSTRAINT domains_pkey PRIMARY KEY (id);
ALTER TABLE public.invitation ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);
ALTER TABLE public.jwks ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);
ALTER TABLE public.member ADD CONSTRAINT member_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_access_token ADD CONSTRAINT oauth_access_token_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_access_token ADD CONSTRAINT oauth_access_token_token_key UNIQUE (token);
ALTER TABLE public.oauth_client_assertion ADD CONSTRAINT oauth_client_assertion_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_client ADD CONSTRAINT oauth_client_client_id_key UNIQUE (client_id);
ALTER TABLE public.oauth_client ADD CONSTRAINT oauth_client_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_client_resource ADD CONSTRAINT oauth_client_resource_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_consent ADD CONSTRAINT oauth_consent_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_pkey PRIMARY KEY (id);
ALTER TABLE public.oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_token_key UNIQUE (token);
ALTER TABLE public.oauth_resource ADD CONSTRAINT oauth_resource_identifier_key UNIQUE (identifier);
ALTER TABLE public.oauth_resource ADD CONSTRAINT oauth_resource_pkey PRIMARY KEY (id);
ALTER TABLE public.organization ADD CONSTRAINT organization_pkey PRIMARY KEY (id);
ALTER TABLE public.organization ADD CONSTRAINT organization_slug_key UNIQUE (slug);
ALTER TABLE public.project_organization ADD CONSTRAINT project_organization_pkey PRIMARY KEY (id);
ALTER TABLE public.project ADD CONSTRAINT project_pkey PRIMARY KEY (id);
ALTER TABLE public.project_user ADD CONSTRAINT project_user_pkey PRIMARY KEY (id);
ALTER TABLE public.session ADD CONSTRAINT session_pkey PRIMARY KEY (id);
ALTER TABLE public.session ADD CONSTRAINT session_token_key UNIQUE (token);
ALTER TABLE public.two_factor ADD CONSTRAINT two_factor_pkey PRIMARY KEY (id);
ALTER TABLE public."user" ADD CONSTRAINT user_email_key UNIQUE (email);
ALTER TABLE public."user" ADD CONSTRAINT user_pkey PRIMARY KEY (id);
ALTER TABLE public.verification ADD CONSTRAINT verification_pkey PRIMARY KEY (id);
CREATE INDEX "account_userId_idx" ON public.account (user_id);
CREATE INDEX "apikey_configId_idx" ON public.apikey (config_id);
CREATE INDEX apikey_key_idx ON public.apikey (key);
CREATE INDEX "apikey_referenceId_idx" ON public.apikey (reference_id);
CREATE UNIQUE INDEX "domains_hostname_rootHostname_uidx" ON public.domains (hostname, root_hostname);
CREATE INDEX "domains_organizationId_idx" ON public.domains (organization_id);
CREATE INDEX "domains_projectId_idx" ON public.domains (project_id);
CREATE INDEX invitation_email_idx ON public.invitation (email);
CREATE INDEX "invitation_organizationId_idx" ON public.invitation (organization_id);
CREATE INDEX "member_organizationId_idx" ON public.member (organization_id);
CREATE INDEX "member_userId_idx" ON public.member (user_id);
CREATE INDEX "oauthAccessToken_authorizationCodeId_idx" ON public.oauth_access_token (authorization_code_id);
CREATE INDEX "oauthAccessToken_clientId_idx" ON public.oauth_access_token (client_id);
CREATE INDEX "oauthAccessToken_refreshId_idx" ON public.oauth_access_token (refresh_id);
CREATE INDEX "oauthAccessToken_sessionId_idx" ON public.oauth_access_token (session_id);
CREATE INDEX "oauthAccessToken_userId_idx" ON public.oauth_access_token (user_id);
CREATE INDEX "oauthClientResource_clientId_idx" ON public.oauth_client_resource (client_id);
CREATE UNIQUE INDEX "oauthClientResource_clientId_resourceId_uidx" ON public.oauth_client_resource (client_id, resource_id);
CREATE INDEX "oauthClientResource_resourceId_idx" ON public.oauth_client_resource (resource_id);
CREATE INDEX "oauthClient_projectId_idx" ON public.oauth_client (project_id);
CREATE INDEX "oauthClient_userId_idx" ON public.oauth_client (user_id);
CREATE INDEX "oauthConsent_clientId_idx" ON public.oauth_consent (client_id);
CREATE INDEX "oauthConsent_userId_idx" ON public.oauth_consent (user_id);
CREATE INDEX "oauthRefreshToken_authorizationCodeId_idx" ON public.oauth_refresh_token (authorization_code_id);
CREATE INDEX "oauthRefreshToken_clientId_idx" ON public.oauth_refresh_token (client_id);
CREATE INDEX "oauthRefreshToken_sessionId_idx" ON public.oauth_refresh_token (session_id);
CREATE INDEX "oauthRefreshToken_userId_idx" ON public.oauth_refresh_token (user_id);
CREATE INDEX "organization_parentId_idx" ON public.organization (parent_id);
CREATE UNIQUE INDEX organization_slug_uidx ON public.organization (slug);
CREATE UNIQUE INDEX "organization_userId_uidx" ON public.organization (user_id);
CREATE INDEX "projectOrganization_organizationId_idx" ON public.project_organization (organization_id);
CREATE INDEX "projectOrganization_projectId_idx" ON public.project_organization (project_id);
CREATE UNIQUE INDEX "projectOrganization_projectId_organizationId_uidx" ON public.project_organization (project_id, organization_id);
CREATE INDEX "projectUser_projectId_idx" ON public.project_user (project_id);
CREATE UNIQUE INDEX "projectUser_projectId_userId_uidx" ON public.project_user (project_id, user_id);
CREATE INDEX "projectUser_userId_idx" ON public.project_user (user_id);
CREATE INDEX "session_userId_idx" ON public.session (user_id);
CREATE INDEX "twoFactor_secret_idx" ON public.two_factor (secret);
CREATE INDEX "twoFactor_userId_idx" ON public.two_factor (user_id);
CREATE INDEX verification_identifier_idx ON public.verification (identifier);
ALTER TABLE public.account ADD CONSTRAINT account_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.domains ADD CONSTRAINT domains_project_id_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project (id) ON DELETE SET NULL;
ALTER TABLE public.invitation ADD CONSTRAINT invitation_inviter_id_user_id_fkey FOREIGN KEY (inviter_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.invitation ADD CONSTRAINT invitation_organization_id_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization (id) ON DELETE CASCADE;
ALTER TABLE public.member ADD CONSTRAINT member_organization_id_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization (id) ON DELETE CASCADE;
ALTER TABLE public.member ADD CONSTRAINT member_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.oauth_access_token ADD CONSTRAINT oauth_access_token_client_id_oauth_client_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE public.oauth_access_token ADD CONSTRAINT oauth_access_token_refresh_id_oauth_refresh_token_id_fkey FOREIGN KEY (refresh_id) REFERENCES public.oauth_refresh_token (id) ON DELETE CASCADE;
ALTER TABLE public.oauth_access_token ADD CONSTRAINT oauth_access_token_session_id_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.session (id) ON DELETE SET NULL;
ALTER TABLE public.oauth_access_token ADD CONSTRAINT oauth_access_token_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.oauth_client ADD CONSTRAINT oauth_client_project_id_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project (id) ON DELETE SET NULL;
ALTER TABLE public.oauth_client_resource ADD CONSTRAINT oauth_client_resource_client_id_oauth_client_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE public.oauth_client_resource ADD CONSTRAINT "oauth_client_resource_dn2L1gs9Dolm_fkey" FOREIGN KEY (resource_id) REFERENCES public.oauth_resource (identifier) ON DELETE CASCADE;
ALTER TABLE public.oauth_client ADD CONSTRAINT oauth_client_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.oauth_consent ADD CONSTRAINT oauth_consent_client_id_oauth_client_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE public.oauth_consent ADD CONSTRAINT oauth_consent_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_client_id_oauth_client_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.oauth_client (client_id) ON DELETE CASCADE;
ALTER TABLE public.oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_session_id_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.session (id) ON DELETE SET NULL;
ALTER TABLE public.oauth_refresh_token ADD CONSTRAINT oauth_refresh_token_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.organization ADD CONSTRAINT organization_parent_id_organization_id_fkey FOREIGN KEY (parent_id) REFERENCES public.organization (id) ON DELETE SET NULL;
ALTER TABLE public.organization ADD CONSTRAINT organization_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.project_organization ADD CONSTRAINT project_organization_organization_id_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization (id) ON DELETE CASCADE;
ALTER TABLE public.project_organization ADD CONSTRAINT project_organization_project_id_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project (id) ON DELETE CASCADE;
ALTER TABLE public.project_user ADD CONSTRAINT project_user_project_id_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project (id) ON DELETE CASCADE;
ALTER TABLE public.project_user ADD CONSTRAINT project_user_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.session ADD CONSTRAINT session_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
ALTER TABLE public.two_factor ADD CONSTRAINT two_factor_user_id_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;
