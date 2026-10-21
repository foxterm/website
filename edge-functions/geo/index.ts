import type { CloudFunctionContext } from "@edgeone/types";

export function onRequest({ request }: CloudFunctionContext) {
  // @ts-ignore
  const eo = request?.eo;
  const origin = request?.headers.get("origin") || "";

  const allowedOriginRegex =
    /^https:\/\/([a-z0-9-]+\.)*(foxterm\.app|foxterm\.cn)$/i;

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
  };

  if (allowedOriginRegex.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return new Response(JSON.stringify(eo), {
    headers,
  });
}
