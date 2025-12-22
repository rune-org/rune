"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { searchUsersForSharing } from "@/lib/api/users";
import type { UserBasicInfo } from "@/client/types.gen";

interface UserMultiSelectProps {
    selectedUsers: UserBasicInfo[];
    onSelect: (user: UserBasicInfo) => void;
    onRemove: (userId: number) => void;
    disabled?: boolean;
}

export function UserMultiSelect({
    selectedUsers,
    onSelect,
    onRemove,
    disabled,
}: UserMultiSelectProps) {
    const [inputValue, setInputValue] = React.useState("");
    const [open, setOpen] = React.useState(false);
    const [isSearching, setIsSearching] = React.useState(false);
    const [searchResults, setSearchResults] = React.useState<UserBasicInfo[]>([]);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Get IDs of already selected users for filtering
    const selectedUserIds = React.useMemo(
        () => new Set(selectedUsers.map((u) => u.id)),
        [selectedUsers]
    );

    // Filter out already-selected users from search results
    const availableUsers = React.useMemo(
        () => searchResults.filter((u) => !selectedUserIds.has(u.id)),
        [searchResults, selectedUserIds]
    );

    // Debounced search function
    const searchUsers = React.useCallback(async (query: string) => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await searchUsersForSharing(query, 20);
                if (response.data?.data) {
                    setSearchResults(response.data.data);
                }
            } catch (error) {
                console.error("Failed to search users:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce
    }, []);

    // Trigger search when input changes
    React.useEffect(() => {
        // Only search if there's input and dropdown is open
        if (inputValue.trim() && open) {
            searchUsers(inputValue);
        } else if (!inputValue.trim() && open) {
            // Fetch initial results when opening with no input
            searchUsers("");
        }
    }, [inputValue, open, searchUsers]);

    // Clean up debounce on unmount
    React.useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleUnselect = (userId: number) => {
        onRemove(userId);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = inputRef.current;
        if (input) {
            if (e.key === "Delete" || e.key === "Backspace") {
                if (input.value === "" && selectedUsers.length > 0) {
                    handleUnselect(selectedUsers[selectedUsers.length - 1].id);
                }
            }
            if (e.key === "Escape") {
                input.blur();
                setOpen(false);
            }
        }
    };

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div
                className={cn(
                    "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[calc(var(--radius)-0.125rem)] border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring/70 focus-within:ring-offset-2",
                    disabled && "cursor-not-allowed opacity-50"
                )}
                onClick={() => {
                    if (!disabled) {
                        inputRef.current?.focus();
                        setOpen(true);
                    }
                }}
            >
                {selectedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                        {user.name}
                        <button
                            className="ml-1 rounded-full ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={() => handleUnselect(user.id)}
                        >
                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                    </Badge>
                ))}
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setOpen(true)}
                    placeholder={
                        selectedUsers.length === 0 ? "Search for users..." : ""
                    }
                    className="ml-1 flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[120px]"
                    disabled={disabled}
                />
            </div>

            {open && (
                <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-[calc(var(--radius)-0.125rem)] border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {isSearching ? (
                            <div className="flex items-center justify-center py-4 text-muted-foreground">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                <span className="ml-2 text-sm">Searching...</span>
                            </div>
                        ) : availableUsers.length > 0 ? (
                            availableUsers.map((user) => (
                                <div
                                    key={user.id}
                                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onClick={() => {
                                        onSelect(user);
                                        setInputValue("");
                                        inputRef.current?.focus();
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span>{user.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {user.email}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : inputValue ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                                No users found matching &quot;{inputValue}&quot;
                            </div>
                        ) : (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                                Type to search for users
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
