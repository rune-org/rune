import {
  loginAuthLoginPost,
  refreshAuthRefreshPost,
  logoutAuthLogoutPost,
  getMyProfileProfileMeGet,
  createUserUsersPost,
} from "@/client";

import type {
  GetMyProfileProfileMeGetResponse,
  LoginAuthLoginPostResponse,
  RefreshAuthRefreshPostResponse,
  LogoutAuthLogoutPostResponse,
} from "@/client/types.gen";

// Readable wrappers for auth-related SDK functions

export const login = (email: string, password: string) =>
  loginAuthLoginPost({ body: { email, password } });

export const refreshAccessToken = (refresh_token: string) =>
  refreshAuthRefreshPost({ body: { refresh_token } });

export const logout = () => logoutAuthLogoutPost({});

export const getMyProfile = () => getMyProfileProfileMeGet({});

export const adminCreateUser = (
  name: string,
  email: string,
  role: "user" | "admin" = "user",
) => createUserUsersPost({ body: { name, email, role } });

// Useful types to consume in app code
export type MyProfileResponse = GetMyProfileProfileMeGetResponse;
export type LoginResponse = LoginAuthLoginPostResponse;
export type RefreshResponse = RefreshAuthRefreshPostResponse;
export type LogoutResponse = LogoutAuthLogoutPostResponse;
