import { useState, useCallback } from "react";
import {
  getAllUsersUsersGet,
  createUserUsersPost,
  updateUserUsersUserIdPut,
  deleteUserUsersUserIdDelete,
  setUserStatusUsersUserIdStatusPatch,
} from "@/client";
import type {
  UserResponse,
  UserCreate,
  AdminUserUpdate,
  CreateUserResponse,
} from "@/client/types.gen";
import { toast } from "@/components/ui/toast";

interface UseUserManagementReturn {
  users: UserResponse[];
  loading: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (
    name: string,
    email: string,
    role: "user" | "admin"
  ) => Promise<CreateUserResponse | null>;
  updateUser: (
    userId: number,
    name: string,
    email: string,
    role: "user" | "admin"
  ) => Promise<boolean>;
  deleteUser: (userId: number) => Promise<boolean>;
  toggleUserStatus: (userId: number, isActive: boolean) => Promise<boolean>;
}

/**
 * Type guard for API errors that may contain detail or message fields
 */
function isErrorWithDetail(
  error: unknown
): error is { detail?: string; message?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    ("detail" in error || "message" in error)
  );
}

/**
 * Safely extracts an error message from unknown error types
 */
function extractErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (isErrorWithDetail(error)) {
    return error.detail ?? error.message ?? fallback;
  }
  return fallback;
}

export function useUserManagement(): UseUserManagementReturn {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllUsersUsersGet();

      if (res.data?.data) {
        setUsers(res.data.data);
      } else {
        setUsers([]);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch users", err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(
    async (
      name: string,
      email: string,
      role: "user" | "admin"
    ): Promise<CreateUserResponse | null> => {
      const normalized = email.trim().toLowerCase();

      // Prevent inviting existing users
      const alreadyExists = users.some(
        (u) => u.email.toLowerCase() === normalized
      );

      if (alreadyExists) {
        toast.info("User is already in the organization");
        return null;
      }

      const payload: UserCreate = {
        name,
        email: normalized,
        role,
      };

      try {
        const response = await createUserUsersPost({
          body: payload,
        });

        const created = (response as unknown as { data?: CreateUserResponse })?.data;

        if (!created) {
          toast.error("Failed to create user");
          return null;
        }

        await fetchUsers();
        return created;
      } catch (err: unknown) {
        console.error("Failed to create user:", err);
        const errorMessage = extractErrorMessage(
          err,
          "Failed to create user"
        );
        toast.error(errorMessage);
        return null;
      }
    },
    [users, fetchUsers]
  );

  const updateUser = useCallback(
    async (
      userId: number,
      name: string,
      email: string,
      role: "user" | "admin"
    ): Promise<boolean> => {
      const payload: AdminUserUpdate = {
        name,
        email,
        role,
      };

      try {
        await updateUserUsersUserIdPut({
          path: { user_id: userId },
          body: payload,
        });

        toast.success("User updated");
        await fetchUsers();
        return true;
      } catch (err: unknown) {
        console.error("Failed to update user:", err);
        const errorMessage = extractErrorMessage(
          err,
          "Failed to update user"
        );
        toast.error(errorMessage);
        return false;
      }
    },
    [fetchUsers]
  );

  const deleteUser = useCallback(
    async (userId: number): Promise<boolean> => {
      try {
        await deleteUserUsersUserIdDelete({
          path: { user_id: userId },
        });

        toast.success("User deleted");
        await fetchUsers();
        return true;
      } catch (err: unknown) {
        console.error("Failed to delete user:", err);
        const errorMessage = extractErrorMessage(
          err,
          "Failed to delete user"
        );
        toast.error(errorMessage);
        return false;
      }
    },
    [fetchUsers]
  );

  const toggleUserStatus = useCallback(
    async (
      userId: number,
      isActive: boolean
    ): Promise<boolean> => {
      try {
        await setUserStatusUsersUserIdStatusPatch({
          path: { user_id: userId },
          body: { is_active: isActive },
        });

        toast.success(
          isActive ? "User activated" : "User deactivated"
        );
        await fetchUsers();
        return true;
      } catch (err: unknown) {
        console.error(
          "Failed to update user status:",
          err
        );
        const errorMessage = extractErrorMessage(
          err,
          "Failed to update user status"
        );
        toast.error(errorMessage);
        return false;
      }
    },
    [fetchUsers]
  );

  return {
    users,
    loading,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
  };
}