import { Effect, Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/http-api";
import { CurrentActor } from "../access.js";
import { Organization, User } from "../schema.js";
import { AuthService } from "../service.js";
import { ActorRequired } from "./actor.js";
import { AuthMiddleware } from "./middleware.js";

export const IdentityApiGroup = HttpApiGroup.make("identity")
  .add(
    HttpApiEndpoint.get("getCurrentIdentity", "/identity", {
      success: Schema.Struct({
        user: Schema.NullOr(User),
        organization: Schema.NullOr(Organization),
      }).annotate({ identifier: "CurrentIdentity" }),
      error: [
        HttpApiError.Unauthorized,
        HttpApiError.Forbidden,
        HttpApiError.ServiceUnavailable,
      ],
    }).annotateMerge(
      OpenApi.annotations({
        summary:
          "Get the current user and organization / Obtenir l’utilisateur et l’organisation actuels",
        description:
          "Returns the user and active organization resolved by this project’s authentication, when available. / Renvoie l’utilisateur et l’organisation active déterminés par l’authentification de ce projet, s’ils sont disponibles.",
      }),
    ),
  )
  .middleware(ActorRequired({ allowNoOrganization: true }))
  .middleware(AuthMiddleware);

export const getCurrentIdentity = Effect.fn("Auth.getCurrentIdentity")(
  function* () {
    const auth = yield* AuthService;
    const { actor, organizationId } = yield* CurrentActor;
    const userId =
      actor.type === "user"
        ? actor.userId
        : actor.owner.type === "user"
          ? actor.owner.userId
          : null;
    const user = userId
      ? yield* auth.users
          .getUser({ params: { id: userId } })
          .pipe(
            Effect.mapError(() => new HttpApiError.ServiceUnavailable({})),
          )
      : null;
    if (!organizationId) return { user, organization: null };

    const organization = yield* auth.organizations
      .getOrganization({ params: { id: organizationId } })
      .pipe(Effect.mapError(() => new HttpApiError.ServiceUnavailable({})));
    return { user, organization };
  },
);
