import type { CloudFunctionContext } from "@edgeone/types";

export function onRequest({ request }: CloudFunctionContext) {
  // @ts-ignore
  const eo = request?.eo;
  const origin = request?.headers.get("origin") || "";

  const allowedOriginRegex =
    /^https:\/\/([a-z0-9-]+\.)*(foxterm\.app|foxterm\.cn)$/i;

  let allowOriginValue = "";

  if (allowedOriginRegex.test(origin)) {
    allowOriginValue = origin;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json; charset=UTF-8",
  };

  if (allowOriginValue) {
    headers["Access-Control-Allow-Origin"] = allowOriginValue;
  }

  return new Response(JSON.stringify(eo), {
    headers,
  });
}
