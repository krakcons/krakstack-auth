import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Schema } from "effect";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { Eye, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  DataTable,
  type DataTableColDef,
} from "@krak-stack/registry/data-table";
import { ErrorMessage } from "@krak-stack/registry/effect-form";
import { AppBrand } from "@krak-stack/registry/app-brand";
import { Query } from "@krak-stack/registry/query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AdminApiClient } from "@/lib/admin-api-client";
import { assetUrl } from "@/lib/assets";
import { m } from "@/paraglide/messages";
import { authBaseUrl } from "@/services/auth/client";
import type { Project } from "@/services/projects/schema";

import { ProjectForm } from "./form";

const projectsAtom = Atom.family((reloadKey: number) =>
  AdminApiClient.query("projects", "listProjects", {
    timeToLive: "1 minute",
    reactivityKeys: ["projects"],
    serializationKey: `projects:${reloadKey}`,
  }),
);

const deleteProjectAtom = AdminApiClient.mutation("projects", "deleteProject");

export function ProjectsTable({ reloadKey = 0 }: { reloadKey?: number }) {
  const navigate = useNavigate({ from: "/admin/projects" });
  const search = useSearch({ from: "/admin/projects" });
  const result = useAtomValue(projectsAtom(reloadKey));
  const deleteProject = useAtomSet(deleteProjectAtom, { mode: "promise" });
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const rows =
    projects ??
    AsyncResult.match(result, {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: ({ value }) => Array.from(value),
    });
  const error = AsyncResult.match(result, {
    onInitial: () => "",
    onFailure: () => m.project_fetch_error(),
    onSuccess: () => "",
  });

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorMessage text={error} /> : null}
      <DataTable
        columnDefs={projectColumns()}
        rowData={rows}
        features={{
          export: { baseName: "projects" },
          gallery: false,
          rowActions: {
            items: [
              {
                name: m.admin_action_preview(),
                icon: <Eye className="size-4" />,
                onClick: (project) => {
                  window.open(
                    `/sign-in?projectId=${encodeURIComponent(project.id)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                },
              },
              {
                name: m.admin_action_edit(),
                icon: <Pencil className="size-4" />,
                onClick: setEditingProject,
              },
              {
                name: m.actions_delete(),
                icon: <Trash2 className="size-4" />,
                variant: "destructive",
                onClick: setDeletingProject,
              },
            ],
          },
        }}
        initialState={search}
        onStateChange={(state) =>
          void navigate({
            search: Schema.encodeSync(Query)(state),
          })
        }
      />
      {editingProject ? (
        <ProjectForm
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={(updated) => {
            setProjects((current) =>
              (current ?? rows).map((project) =>
                project.id === updated.id ? updated : project,
              ),
            );
          }}
        />
      ) : null}
      {deletingProject ? (
        <DeleteProjectDialog
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
          onDeleted={(deleted) => {
            setProjects((current) =>
              (current ?? rows).filter((project) => project.id !== deleted.id),
            );
          }}
          deleteProject={deleteProject}
        />
      ) : null}
    </div>
  );
}

const projectColumns = (): DataTableColDef<Project>[] => [
  {
    field: "name",
    headerName: m.project(),
    cellRenderer: ({ data }) => {
      const logo = assetUrl(data.logo, authBaseUrl);

      return (
        <AppBrand
          to={null}
          label={data.name}
          subtitle={data.id}
          icon={FolderKanban}
          className="min-w-56"
          {...(logo ? { imageSrc: logo } : {})}
        />
      );
    },
  },
  {
    colId: "authOptions",
    headerName: m.oauth_client_auth_options(),
    cellRenderer: ({ data }) => (
      <div className="flex flex-wrap gap-1.5">
        {data.data.authOptions?.emailPassword !== false ? (
          <Badge variant="secondary">
            {m.oauth_client_auth_email_password()}
          </Badge>
        ) : null}
        {data.data.authOptions?.emailOtp !== false ? (
          <Badge variant="secondary">{m.oauth_client_auth_email_otp()}</Badge>
        ) : null}
        {data.data.authOptions?.google !== false ? (
          <Badge variant="secondary">{m.oauth_client_auth_google()}</Badge>
        ) : null}
      </div>
    ),
  },
  {
    colId: "branding",
    headerName: m.oauth_client_branding(),
    cellRenderer: ({ data }) => (
      <div className="flex flex-wrap gap-1.5">
        {data.logo ? (
          <Badge variant="outline">{m.oauth_client_logo_configured()}</Badge>
        ) : null}
        {data.data.branding?.themeCss ? (
          <Badge variant="outline">{m.oauth_client_theme_configured()}</Badge>
        ) : null}
        {!data.logo && !data.data.branding?.themeCss ? (
          <span className="text-muted-foreground text-sm">
            {m.admin_none()}
          </span>
        ) : null}
      </div>
    ),
  },
];

function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
  deleteProject,
}: {
  project: Project;
  onClose: () => void;
  onDeleted: (project: Project) => void;
  deleteProject: (input: {
    params: { id: string };
    reactivityKeys?: ReadonlyArray<string>;
  }) => Promise<Project>;
}) {
  const [error, setError] = useState("");

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.project_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.project_delete_description({ name: project.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorMessage text={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{m.actions_cancel()}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              setError("");
              try {
                const deleted = await deleteProject({
                  params: { id: project.id },
                  reactivityKeys: ["projects"],
                });
                onDeleted(deleted);
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : m.project_delete_error(),
                );
              }
            }}
          >
            {m.actions_delete()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
