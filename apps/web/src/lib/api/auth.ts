import {
  loginAuthLoginPost,
  refreshAuthRefreshPost,
  logoutAuthLogoutPost,
  getMyProfileProfileMeGet,
  createUserUsersPost,
  firstAdminSignupAuthFirstAdminSignupPost,
  checkFirstTimeSetupAuthFirstTimeSetupGet,
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

export const firstAdminSignup = (name: string, email: string, password: string) =>
  firstAdminSignupAuthFirstAdminSignupPost({ body: { name, email, password } });

export const checkFirstTimeSetup = () => checkFirstTimeSetupAuthFirstTimeSetupGet();

// Useful types to consume in app code
export type MyProfileResponse = GetMyProfileProfileMeGetResponse;
export type LoginResponse = LoginAuthLoginPostResponse;
export type RefreshResponse = RefreshAuthRefreshPostResponse;
export type LogoutResponse = LogoutAuthLogoutPostResponse;
