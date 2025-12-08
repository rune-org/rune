"use client";

import { useState, useMemo, useEffect } from "react";
import { MoreHorizontal, Search, Key, Share2, Users, LogOut } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import type { CredentialResponse, CredentialType, CredentialShareInfo } from "@/client/types.gen";
import {
  getCredentialTypeLabel,
  CREDENTIAL_TYPE_BADGE_STYLES
} from "@/lib/credentials/types";
import { ShareCredentialDialog } from "./ShareCredentialDialog";
import { revokeCredentialAccess, getMyShareInfo } from "@/lib/api/credentials";
import { getUserById } from "@/lib/api/users";
import { useAuth } from "@/lib/auth";

// Re-export for convenience
export type { CredentialType };
export type Credential = CredentialResponse;

function CredentialTypeBadge({ type }: { type: CredentialType }) {
  const label = getCredentialTypeLabel(type);
  const badgeStyle = CREDENTIAL_TYPE_BADGE_STYLES[type];

  return (
    <Badge className={badgeStyle.className} variant="secondary">
      {label}
    </Badge>
  );
}

interface CredentialsTableProps {
  credentials: Credential[];
  onDelete?: (id: number) => void;
  onSharesChanged?: () => void;
  isLoading?: boolean;
}

export function CredentialsTable({
  credentials = [],
  onDelete,
  onSharesChanged,
  isLoading = false,
}: CredentialsTableProps) {
  const { state } = useAuth();
  const currentUserId = state.user?.id;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CredentialType | "all">("all");
  const [shareDialogCredential, setShareDialogCredential] = useState<Credential | null>(null);
  const [leavingCredentialId, setLeavingCredentialId] = useState<number | null>(null);
  const [shareInfoMap, setShareInfoMap] = useState<Record<number, CredentialShareInfo & { shared_by_name?: string | null } | null>>({});
  const [creatorNameMap, setCreatorNameMap] = useState<Record<number, string>>({});

  // Load share info for shared credentials using the my-share endpoint
  useEffect(() => {
    const loadShareInfo = async () => {
      const newShareInfoMap: Record<number, CredentialShareInfo & { shared_by_name?: string | null } | null> = {};

      for (const cred of credentials) {
        if (!cred.is_owner) {
          try {
            const result = await getMyShareInfo(cred.id);
            if (result?.data) {
              newShareInfoMap[cred.id] = result.data;
            } else {
              newShareInfoMap[cred.id] = null;
            }
          } catch (error) {
            console.error(`Failed to load share info for credential ${cred.id}:`, error);
            newShareInfoMap[cred.id] = null;
          }
        }
      }
      setShareInfoMap(newShareInfoMap);
    };

    if (credentials.length > 0) {
      loadShareInfo();
    }
  }, [credentials]);

  // Load creator names for admin-viewed credentials (not owned and not shared with them)
  useEffect(() => {
    const loadCreatorNames = async () => {
      const creatorIds = new Set<number>();

      // Collect unique creator IDs for credentials that are not owned and not shared
      for (const cred of credentials) {
        if (!cred.is_owner && !shareInfoMap[cred.id] && cred.created_by) {
          creatorIds.add(cred.created_by);
        }
      }

      // Fetch creator names
      const newCreatorNameMap: Record<number, string> = { ...creatorNameMap };
      for (const creatorId of creatorIds) {
        if (!newCreatorNameMap[creatorId]) {
          try {
            const result = await getUserById(creatorId);
            if (result?.data?.data?.name) {
              newCreatorNameMap[creatorId] = result.data.data.name;
            }
          } catch (error) {
            console.error(`Failed to load creator name for user ${creatorId}:`, error);
          }
        }
      }

      setCreatorNameMap(newCreatorNameMap);
    };

    // Only run after shareInfoMap is populated
    if (credentials.length > 0 && Object.keys(shareInfoMap).length > 0) {
      loadCreatorNames();
    }
  }, [credentials, shareInfoMap]);

  const handleLeaveCredential = async (credentialId: number) => {
    if (!currentUserId) return;

    setLeavingCredentialId(credentialId);
    try {
      await revokeCredentialAccess(credentialId, currentUserId);
      toast.success("You have left the shared credential");
      onSharesChanged?.();
    } catch (error) {
      console.error("Failed to leave credential:", error);
      toast.error("Failed to leave credential");
    } finally {
      setLeavingCredentialId(null);
    }
  };

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
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Type</TableHead>
            <TableHead className="w-[15%]">Ownership</TableHead>
            <TableHead className="w-[15%]">Created/Shared</TableHead>
            <TableHead className="w-[15%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <p className="text-sm">Loading credentials...</p>
                </div>
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
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
                <TableCell>
                  {c.is_owner ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Owner
                    </Badge>
                  ) : shareInfoMap[c.id] ? (
                    // Shared with current user
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="flex flex-col items-start gap-0 py-1 h-auto">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Shared by
                          </span>
                          {shareInfoMap[c.id]?.shared_by_name && (
                            <span className="text-xs font-medium">
                              {shareInfoMap[c.id]?.shared_by_name}
                            </span>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {shareInfoMap[c.id]?.shared_by_name
                          ? `This credential was shared with you by ${shareInfoMap[c.id]?.shared_by_name}`
                          : "This credential was shared with you"}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    // Admin viewing credential not shared with them
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="flex flex-col items-start gap-0 py-1 h-auto">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Created by
                          </span>
                          {c.created_by && creatorNameMap[c.created_by] && (
                            <span className="text-xs font-medium">
                              {creatorNameMap[c.created_by]}
                            </span>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {c.created_by && creatorNameMap[c.created_by]
                          ? `This credential was created by ${creatorNameMap[c.created_by]}`
                          : "You have admin access to this credential"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                      {c.is_owner ? "Created" : shareInfoMap[c.id] ? "Shared" : "Created"}
                    </span>
                    <span className="text-xs">
                      {c.is_owner
                        ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true })
                        : shareInfoMap[c.id]?.shared_at
                          ? formatDistanceToNow(new Date(shareInfoMap[c.id]!.shared_at), { addSuffix: true })
                          : formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
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
                      {(c.is_owner || c.can_share) && (
                        <>
                          <DropdownMenuItem
                            onClick={() => setShareDialogCredential(c)}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            {c.can_share ? "Manage Sharing" : "View Shares"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {c.can_delete && (
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => onDelete?.(c.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      )}
                      {/* Shared users can leave/revoke their own access */}
                      {shareInfoMap[c.id] && (
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => handleLeaveCredential(c.id)}
                          disabled={leavingCredentialId === c.id}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          {leavingCredentialId === c.id ? "Removing..." : "Remove"}
                        </DropdownMenuItem>
                      )}
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

      {/* Share Credential Dialog */}
      {shareDialogCredential && (
        <ShareCredentialDialog
          open={!!shareDialogCredential}
          onOpenChange={(open) => !open && setShareDialogCredential(null)}
          credentialId={shareDialogCredential.id}
          credentialName={shareDialogCredential.name}
          canShare={shareDialogCredential.can_share ?? false}
          onSharesChanged={onSharesChanged}
        />
      )}
    </div>
  );
}
