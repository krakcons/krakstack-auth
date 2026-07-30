import { Check, X } from "lucide-react";

type PermissionStatements = Readonly<
  Record<string, ReadonlyArray<string> | undefined>
>;

export type PermissionMatrixGrant = {
  id: string;
  label: string;
  statements: PermissionStatements;
};

type PermissionMatrixLabels = {
  action: string;
  allowed: string;
  denied: string;
  resource: string;
};

export const PermissionMatrix = ({
  grants,
  labels,
  statements,
}: {
  grants: ReadonlyArray<PermissionMatrixGrant>;
  labels: PermissionMatrixLabels;
  statements: PermissionStatements;
}) => (
  <div className="overflow-x-auto rounded-xl border">
    <table className="w-full min-w-max border-collapse text-sm">
      <thead className="bg-muted/50">
        <tr>
          <th className="px-4 py-3 text-left font-medium">{labels.resource}</th>
          <th className="px-4 py-3 text-left font-medium">{labels.action}</th>
          {grants.map((grant) => (
            <th className="px-4 py-3 text-center font-medium" key={grant.id}>
              {grant.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Object.entries(statements).flatMap(([resource, actions]) =>
          (actions ?? []).map((action, actionIndex) => (
            <tr className="border-t" key={`${resource}:${action}`}>
              <td className="px-4 py-3 align-top">
                {actionIndex === 0 ? <code>{resource}</code> : null}
              </td>
              <td className="px-4 py-3">
                <code>{action}</code>
              </td>
              {grants.map((grant) => {
                const allowed =
                  grant.statements[resource]?.includes(action) ?? false;
                return (
                  <td className="px-4 py-3 text-center" key={grant.id}>
                    <span className="sr-only">
                      {allowed ? labels.allowed : labels.denied}
                    </span>
                    {allowed ? (
                      <Check
                        aria-hidden="true"
                        className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
                      />
                    ) : (
                      <X
                        aria-hidden="true"
                        className="text-muted-foreground/55 mx-auto size-4"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          )),
        )}
      </tbody>
    </table>
  </div>
);
