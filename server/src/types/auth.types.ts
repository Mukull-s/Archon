/**
 * TypeScript interfaces for the auth system.
 * Shared across services, controllers, and frontend.
 */

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
  html_url: string;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface JWTPayload {
  userId: number;
  login: string;
  avatarUrl: string;
  name: string | null;
  githubToken: string;
}

export interface AuthUser {
  id: number;
  login: string;
  avatarUrl: string;
  name: string | null;
  email: string | null;
  htmlUrl: string;
}
