import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Schema } from "effect";
import { AsyncResult, AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";
import { AuthEmailSettings } from "@/services/auth-emails/schema";
import type { Project } from "../schema";
import { projectsAtom, updateProjectEmailAtom } from "./atom";

let handleRequest: (request: Request) => Promise<Response> = () =>
  Promise.reject(new Error("Project test HTTP adapter is not initialized"));
// FetchHttpClient can retain its fetch implementation across runtime layers.
// Keep the adapter stable and install fresh request state for each test.
const testFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  handleRequest(new Request(input, init));

const initialProjects = (): Array<Project> => [
  {
    id: "edited-project",
    name: "Edited project",
    logo: null,
    data: {
      authOptions: { emailOtp: true },
      email: { appearance: { background: "#123456" } },
    },
    createdAt: new Date("2026-11-05T00:00:00.000Z"),
    updatedAt: new Date("2026-11-05T00:00:00.000Z"),
  },
  {
    id: "other-project",
    name: "Other project",
    logo: null,
    data: {},
    createdAt: new Date("2026-11-05T00:00:00.000Z"),
    updatedAt: new Date("2026-11-05T00:00:00.000Z"),
  },
];

describe("project email optimistic mutations", () => {
  it.effect("rolls back only the edited project after a failed save", () =>
    Effect.gen(function* () {
      const before = initialProjects();
      const services = yield* Effect.context<never>();
      const started = yield* Deferred.make<AuthEmailSettings>();
      const response = yield* Deferred.make<Response>();
      vi.stubGlobal("fetch", testFetch);
      handleRequest = (request) => {
        if (request.method === "GET")
          return Promise.resolve(Response.json(before));
        return Effect.runPromiseWith(services)(
          Effect.gen(function* () {
            const payload = yield* Effect.promise(() => request.json());
            const settings =
              yield* Schema.decodeUnknownEffect(AuthEmailSettings)(payload);
            yield* Deferred.succeed(started, settings);
            return yield* Deferred.await(response);
          }),
        );
      };
      const registry = AtomRegistry.make();
      const unmount = registry.mount(projectsAtom);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          unmount();
          registry.dispose();
          vi.unstubAllGlobals();
        }),
      );
      expect(yield* AtomRegistry.getResult(registry, projectsAtom)).toEqual(
        before,
      );
      const draft = { appearance: { background: "#abcdef" } };
      registry.set(updateProjectEmailAtom, {
        params: { id: "edited-project" },
        payload: draft,
      });
      expect(yield* Deferred.await(started)).toEqual(draft);
      const optimistic = registry.get(projectsAtom);
      expect(AsyncResult.isSuccess(optimistic)).toBe(true);
      expect(AsyncResult.getOrElse(optimistic, () => [])).toEqual([
        { ...before[0], data: { ...before[0]?.data, email: draft } },
        before[1],
      ]);
      yield* Deferred.succeed(
        response,
        Response.json({ _tag: "InternalServerError" }, { status: 500 }),
      );
      const result = yield* AtomRegistry.getResult(
        registry,
        updateProjectEmailAtom,
        { suspendOnWaiting: true },
      ).pipe(Effect.exit);
      expect(result._tag).toBe("Failure");
      expect(
        yield* AtomRegistry.getResult(registry, projectsAtom, {
          suspendOnWaiting: true,
        }),
      ).toEqual(before);
    }).pipe(Effect.scoped),
  );

  it.effect(
    "keeps unrelated settings optimistic and reconciles with authoritative data after success",
    () =>
      Effect.gen(function* () {
        let serverProjects = initialProjects();
        const services = yield* Effect.context<never>();
        const started = yield* Deferred.make<void>();
        const response = yield* Deferred.make<Response>();
        let reads = 0;
        vi.stubGlobal("fetch", testFetch);
        handleRequest = (request) => {
          if (request.method === "GET") {
            reads++;
            return Promise.resolve(Response.json(serverProjects));
          }
          return Effect.runPromiseWith(services)(
            Effect.gen(function* () {
              yield* Deferred.succeed(started, undefined);
              return yield* Deferred.await(response);
            }),
          );
        };
        const registry = AtomRegistry.make();
        const unmount = registry.mount(projectsAtom);
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            unmount();
            registry.dispose();
            vi.unstubAllGlobals();
          }),
        );
        const before = yield* AtomRegistry.getResult(registry, projectsAtom);
        const first = before[0];
        if (!first) return yield* Effect.die("Missing project fixture");
        const draft = {
          templates: { "sign-in": { fr: { title: "Bienvenue" } } },
        };
        registry.set(updateProjectEmailAtom, {
          params: { id: first.id },
          payload: draft,
        });
        yield* Deferred.await(started);
        expect(
          AsyncResult.getOrElse(registry.get(projectsAtom), () => [])[0]?.data,
        ).toEqual({ ...first.data, email: draft });
        const authoritative = {
          ...first,
          name: "Authoritative project name",
          data: { ...first.data, email: draft },
        };
        serverProjects = [authoritative, ...before.slice(1)];
        yield* Deferred.succeed(response, Response.json(authoritative));
        expect(
          yield* AtomRegistry.getResult(registry, updateProjectEmailAtom, {
            suspendOnWaiting: true,
          }),
        ).toEqual(authoritative);
        expect(
          yield* AtomRegistry.getResult(registry, projectsAtom, {
            suspendOnWaiting: true,
          }),
        ).toEqual(serverProjects);
        expect(reads).toBeGreaterThan(1);
      }).pipe(Effect.scoped),
  );
});
