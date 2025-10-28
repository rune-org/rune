"use client";

import { useState, useMemo } from "react";
import { MoreHorizontal, Search, Key} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CredentialResponse, CredentialType } from "@/client/types.gen";

// Re-export for convenience
export type { CredentialType };
export type Credential = CredentialResponse;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) {
    const m = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `${m}m ago`;
  }
  if (h < 24) {
    return `${h}hr. ago`;
  }
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function CredentialTypeBadge({ type }: { type: CredentialType }) {
  const variants: Record<
    CredentialType,
    { label: string; className: string }
  > = {
    api_key: {
      label: "API Key",
      className: "bg-blue-900/40 text-blue-200",
    },
    oauth2: {
      label: "OAuth2",
      className: "bg-purple-900/40 text-purple-200",
    },
    basic_auth: {
      label: "Basic Auth",
      className: "bg-green-900/40 text-green-200",
    },
    token: {
      label: "Token",
      className: "bg-amber-900/40 text-amber-200",
    },
    smtp: {
      label: "SMTP",
      className: "bg-cyan-900/40 text-cyan-200",
    },
    custom: {
      label: "Custom",
      className: "bg-slate-800 text-slate-200",
    },
  };

  const variant = variants[type];

  return (
    <Badge className={variant.className} variant="secondary">
      {variant.label}
    </Badge>
  );
}

interface CredentialsTableProps {
  credentials: Credential[];
  onDelete?: (id: number) => void;
  isLoading?: boolean;
}

export function CredentialsTable({
  credentials = [],
  onDelete,
  isLoading = false,
}: CredentialsTableProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CredentialType | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = credentials;

    if (typeFilter !== "all") {
      list = list.filter((c) => c.credential_type === typeFilter);
    }

    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [credentials, query, typeFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search credentials..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) =>
            setTypeFilter(value as CredentialType | "all")
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="pl-8">All Types</SelectItem>
            <SelectItem value="api_key" className="pl-8">API Key</SelectItem>
            <SelectItem value="oauth2" className="pl-8">OAuth2</SelectItem>
            <SelectItem value="basic_auth" className="pl-8">Basic Auth</SelectItem>
            <SelectItem value="token" className="pl-8">Token</SelectItem>
            <SelectItem value="smtp" className="pl-8">SMTP</SelectItem>
            <SelectItem value="custom" className="pl-8">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Name</TableHead>
            <TableHead className="w-[25%]">Type</TableHead>
            <TableHead className="w-[20%]">Created</TableHead>
            <TableHead className="w-[15%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <p className="text-sm">Loading credentials...</p>
                </div>
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Key className="h-8 w-8" />
                  <p className="text-sm">
                    {credentials.length === 0
                      ? "No credentials yet. Add your first credential to get started."
                      : "No credentials found."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">
                  {c.name}
                </TableCell>
                <TableCell>
                  <CredentialTypeBadge type={c.credential_type} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {timeAgo(c.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label={`Actions for ${c.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={() => onDelete?.(c.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableCaption>
          {filtered.length === 0
            ? credentials.length === 0
              ? "Start by adding your first credential."
              : "No credentials found."
            : `${filtered.length} credential${filtered.length > 1 ? "s" : ""} total.`}
        </TableCaption>
      </Table>
    </div>
  );
}
