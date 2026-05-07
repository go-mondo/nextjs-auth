import * as oidc from "openid-client";
import type { Config } from "../config/types";

export async function discoverOIDC(
  config: Config,
): Promise<oidc.Configuration> {
  console.log(
    "Discovering OIDC with issuer:",
    new URL(
      "/.well-known/openid-configuration",
      config.issuerBaseURL,
    ).toString(),
  );

  const isLocalDevelopment =
    config.issuerBaseURL.includes("localhost") ||
    config.issuerBaseURL.includes("127.0.0.1");

  return await oidc.discovery(
    new URL(config.issuerBaseURL),
    config.clientId,
    config.clientSecret,
    undefined,
    isLocalDevelopment
      ? {
          execute: [oidc.allowInsecureRequests],
        }
      : undefined,
  );
}
