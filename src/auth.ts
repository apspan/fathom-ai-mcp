import { randomUUID } from "crypto";
import type { Response, RequestHandler } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

interface PendingAuth {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  claudeState?: string;
  createdAt: number;
}

interface StoredAuth {
  clientId: string;
  codeChallenge: string;
  fathomTokens: OAuthTokens;
}

export interface FathomOAuthConfig {
  fathomClientId: string;
  fathomClientSecret: string;
  fathomAuthorizeUrl: string;
  fathomTokenUrl: string;
  serverBaseUrl: string;
}

class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.clients.get(clientId);
  }

  registerClient(client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">): OAuthClientInformationFull {
    const clientId = randomUUID();
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(clientId, full);
    return full;
  }
}

export class FathomOAuthProvider implements OAuthServerProvider {
  private _clientsStore = new InMemoryClientsStore();
  private pendingAuths = new Map<string, PendingAuth>();
  private authCodes = new Map<string, StoredAuth>();
  private config: FathomOAuthConfig;

  constructor(config: FathomOAuthConfig) {
    this.config = config;
    // Clean up stale pending auths every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, pending] of this.pendingAuths) {
        if (now - pending.createdAt > 10 * 60 * 1000) {
          this.pendingAuths.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const ourState = randomUUID();

    this.pendingAuths.set(ourState, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      claudeState: params.state,
      createdAt: Date.now(),
    });

    const fathomUrl = new URL(this.config.fathomAuthorizeUrl);
    fathomUrl.searchParams.set("client_id", this.config.fathomClientId);
    fathomUrl.searchParams.set("response_type", "code");
    fathomUrl.searchParams.set("redirect_uri", `${this.config.serverBaseUrl}/callback`);
    fathomUrl.searchParams.set("state", ourState);
    fathomUrl.searchParams.set("scope", "public_api");

    res.redirect(fathomUrl.toString());
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const stored = this.authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    return stored.codeChallenge;
  }

  async exchangeAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const stored = this.authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    this.authCodes.delete(authorizationCode);
    return stored.fathomTokens;
  }

  async exchangeRefreshToken(_client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(this.config.fathomTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.config.fathomClientId,
        client_secret: this.config.fathomClientSecret,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Fathom token refresh failed: ${response.status} ${body}`);
    }

    return await response.json() as OAuthTokens;
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // We trust the token and let the Fathom API reject invalid ones at call time.
    return {
      token,
      clientId: "fathom",
      scopes: ["public_api"],
    };
  }

  async revokeToken(_client: OAuthClientInformationFull, _request: OAuthTokenRevocationRequest): Promise<void> {
    // No-op: Fathom token revocation not supported
  }

  /**
   * Handle the callback from Fathom's OAuth.
   * Exchanges Fathom's auth code for tokens, generates our own auth code,
   * and redirects back to Claude's callback URL.
   */
  createCallbackHandler(): RequestHandler {
    return async (req, res) => {
      const { code, state, error } = req.query;

      if (error) {
        res.status(400).json({ error: `Fathom OAuth error: ${error}` });
        return;
      }

      if (!code || !state || typeof code !== "string" || typeof state !== "string") {
        res.status(400).json({ error: "Missing code or state parameter" });
        return;
      }

      const pending = this.pendingAuths.get(state);
      if (!pending) {
        res.status(400).json({ error: "Invalid or expired state parameter" });
        return;
      }
      this.pendingAuths.delete(state);

      // Exchange Fathom's auth code for tokens
      const tokenResponse = await fetch(this.config.fathomTokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: this.config.fathomClientId,
          client_secret: this.config.fathomClientSecret,
          redirect_uri: `${this.config.serverBaseUrl}/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        res.status(502).json({ error: `Fathom token exchange failed: ${tokenResponse.status} ${body}` });
        return;
      }

      const fathomTokens = await tokenResponse.json() as OAuthTokens;

      // Generate our own auth code for Claude
      const ourAuthCode = randomUUID();
      this.authCodes.set(ourAuthCode, {
        clientId: pending.clientId,
        codeChallenge: pending.codeChallenge,
        fathomTokens,
      });

      // Redirect back to Claude's callback
      const redirectUrl = new URL(pending.redirectUri);
      redirectUrl.searchParams.set("code", ourAuthCode);
      if (pending.claudeState) {
        redirectUrl.searchParams.set("state", pending.claudeState);
      }

      res.redirect(redirectUrl.toString());
    };
  }
}
