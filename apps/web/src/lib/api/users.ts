import {
  getAllUsersUsersGet,
  getUserByIdUsersUserIdGet,
  createUserUsersPost,
  updateUserUsersUserIdPut,
  deleteUserUsersUserIdDelete,
  getMyProfileProfileMeGet,
  updateMyProfileProfileMePut,
  listUsersForSharingUsersDirectoryGet,
} from "@/client";

import type {
  UserCreate,
  AdminUserUpdate,
  ProfileUpdate,
  GetAllUsersUsersGetResponse,
  GetUserByIdUsersUserIdGetResponse,
  CreateUserUsersPostResponse,
  UpdateUserUsersUserIdPutResponse,
  DeleteUserUsersUserIdDeleteResponse,
  GetMyProfileProfileMeGetResponse,
  UpdateMyProfileProfileMePutResponse,
} from "@/client/types.gen";

// Readable wrappers for user-related SDK functions

export const listUsers = () => getAllUsersUsersGet();

export const listUsersForSharing = () => listUsersForSharingUsersDirectoryGet();

export const getUserById = (user_id: number) =>
  getUserByIdUsersUserIdGet({ path: { user_id } });

export const createUser = (payload: UserCreate) =>
  createUserUsersPost({ body: payload });

export const updateUser = (user_id: number, payload: AdminUserUpdate) =>
  updateUserUsersUserIdPut({ path: { user_id }, body: payload });

export const deleteUser = (user_id: number) =>
  deleteUserUsersUserIdDelete({ path: { user_id } });

export const getMyProfile = () => getMyProfileProfileMeGet({});

export const updateMyProfile = (payload: ProfileUpdate) =>
  updateMyProfileProfileMePut({ body: payload });

// Response types
export type ListUsersResponse = GetAllUsersUsersGetResponse;
export type GetUserByIdResponse = GetUserByIdUsersUserIdGetResponse;
export type CreateUserResponse = CreateUserUsersPostResponse;
export type UpdateUserResponse = UpdateUserUsersUserIdPutResponse;
export type DeleteUserResponse = DeleteUserUsersUserIdDeleteResponse;
export type MyProfileResponse = GetMyProfileProfileMeGetResponse;
export type UpdateMyProfileResponse = UpdateMyProfileProfileMePutResponse;
