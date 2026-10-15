import { displayLabel } from "@/lib/l10n";
import { useUser } from "@/lib/hooks";
import { ICONS } from "@/lib/icons";
import { ConfirmButton } from "mogh_ui";
import { ConfirmModal } from "mogh_ui";
import { DataTable, DataTableFeatures } from "mogh_ui";
import { StatusBadge } from "mogh_ui";
import { Badge, BoxProps } from "@mantine/core";
import { ColumnDef } from "@tanstack/react-table";
import { Types } from "komodo_client";
import { useNavigate } from "react-router-dom";

export interface UserTableProps extends BoxProps {
  users: Types.User[];
  onUserRemove?: (user_id: string) => void;
  onUserDelete?: (user_id: string) => Promise<unknown>;
  userDeleteDisabled?: (user_id: string) => boolean;
  noBorder?: boolean;
}

export default function UserTable({
  users,
  onUserRemove,
  onUserDelete,
  userDeleteDisabled,
  noBorder,
  ...boxProps
}: UserTableProps) {
  const user = useUser().data;
  const nav = useNavigate();
  const columns: ColumnDef<
    DataTableFeatures,
    Types.User,
    "User" | "Admin" | "Super Admin"
  >[] = [
    { header: "用户名", accessorKey: "username" },
    {
      header: "类型",
      accessorKey: "config.type",
      cell: ({ row }) => (
        <Badge>
          {row.original.config.type === "Service"
            ? "服务用户"
            : displayLabel(row.original.config.type)}
        </Badge>
      ),
    },
    {
      header: "级别",
      accessorFn: (user) =>
        user.admin ? (user.super_admin ? "Super Admin" : "Admin") : "User",
      cell: ({ row }) =>
        row.original.admin
          ? row.original.super_admin
            ? "超级管理员"
            : "管理员"
          : "用户",
    },
    {
      header: "已启用",
      cell: ({ row }) => {
        return (
          <StatusBadge
            text={row.original.enabled ? "已启用" : "已禁用"}
            intent={row.original.enabled ? "Good" : "Critical"}
          />
        );
      },
    },
  ];

  if (onUserRemove) {
    columns.push({
      header: "移除",
      cell: ({ row }) => (
        <ConfirmButton
          variant="filled"
          color="red"
          icon={<ICONS.Remove size="1rem" />}
          onClick={(e) => {
            e.stopPropagation();
            onUserRemove(row.original._id?.$oid!);
          }}
        >
          移除
        </ConfirmButton>
      ),
    });
  }

  if (onUserDelete) {
    columns.push({
      header: "删除",
      cell: ({ row }) => (
        <ConfirmModal
          icon={<ICONS.Delete size="1rem" />}
          confirmText={row.original.username}
          onConfirm={() => onUserDelete(row.original._id?.$oid!)}
          disabled={
            row.original._id?.$oid
              ? (userDeleteDisabled?.(row.original._id.$oid) ?? true)
              : true
          }
          confirmProps={{ variant: "filled", color: "red" }}
        >
          删除
        </ConfirmModal>
      ),
    });
  }

  return (
    <DataTable
      noBorder={noBorder}
      tableKey="user-table"
      data={users}
      columns={columns}
      onRowClick={(row) =>
        row._id?.$oid === user?._id?.$oid
          ? nav("/profile")
          : nav(`/users/${row._id!.$oid}`)
      }
      {...boxProps}
    />
  );
}
