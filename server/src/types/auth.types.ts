export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  emailVerified: boolean;
  githubLogin: string | null;
}

export interface JWTPayload {
  userId: string;
  email: string;
  provider: string;
  githubToken?: string;
}

export interface GitHubProfile {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
