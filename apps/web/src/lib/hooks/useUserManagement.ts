import { useState, useCallback } from "react";
import {
  getAllUsersUsersGet,
  createUserUsersPost,
  updateUserUsersUserIdPut,
  deleteUserUsersUserIdDelete,
  setUserStatusUsersUserIdStatusPatch,
} from "@/client";
import type { UserResponse, UserCreate, AdminUserUpdate, CreateUserResponse } from "@/client/types.gen";
import { toast } from "@/components/ui/toast";

interface UseUserManagementReturn {
  users: UserResponse[];
  loading: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (name: string, email: string, role: "user" | "admin") => Promise<CreateUserResponse | null>;
  updateUser: (userId: number, name: string, email: string, role: "user" | "admin") => Promise<boolean>;
  deleteUser: (userId: number) => Promise<boolean>;
  toggleUserStatus: (userId: number, isActive: boolean) => Promise<boolean>;
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
    } catch (err) {
      console.error("Failed to fetch users", err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (
    name: string,
    email: string,
    role: "user" | "admin"
  ): Promise<CreateUserResponse | null> => {
    const normalized = email.trim().toLowerCase();

    // Prevent inviting existing users
    const alreadyExists = users.some((u) => u.email.toLowerCase() === normalized);
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
      const { data, error } = await createUserUsersPost({ body: payload });

      if (error) {
        console.error("Failed to create user:", error);
        toast.error("Failed to create user");
        return null;
      }

      const created = data?.data as CreateUserResponse | undefined;

      if (!created) {
        toast.error("Failed to create user");
        return null;
      }

      // Refresh users list
      await fetchUsers();

      return created;
    } catch (err) {
      console.error("Failed to create user:", err);
      toast.error("Failed to create user");
      return null;
    }
  }, [users, fetchUsers]);

  const updateUser = useCallback(async (
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
      const { error } = await updateUserUsersUserIdPut({
        path: { user_id: userId },
        body: payload,
      });

      if (error) {
        console.error("Failed to update user:", error);
        toast.error("Failed to update user");
        return false;
      }

      toast.success("User updated");
      await fetchUsers();
      return true;
    } catch (err) {
      console.error("Failed to update user:", err);
      toast.error("Failed to update user");
      return false;
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: number): Promise<boolean> => {
    try {
      const { error } = await deleteUserUsersUserIdDelete({
        path: { user_id: userId },
      });

      if (error) {
        console.error("Failed to delete user:", error);
        toast.error("Failed to delete user");
        return false;
      }

      toast.success("User deleted");
      await fetchUsers();
      return true;
    } catch (err) {
      console.error("Failed to delete user:", err);
      toast.error("Failed to delete user");
      return false;
    }
  }, [fetchUsers]);

  const toggleUserStatus = useCallback(async (userId: number, isActive: boolean): Promise<boolean> => {
    try {
      const { error } = await setUserStatusUsersUserIdStatusPatch({
        path: { user_id: userId },
        body: { is_active: isActive },
      });

      if (error) {
        console.error("Failed to update user status:", error);
        toast.error("Failed to update user status");
        return false;
      }

      toast.success(isActive ? "User activated" : "User deactivated");
      await fetchUsers();
      return true;
    } catch (err) {
      console.error("Failed to update user status:", err);
      toast.error("Failed to update user status");
      return false;
    }
  }, [fetchUsers]);

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
