const MANIFEST_KEY = "manifest.json";
const HELPER_KEY = "remote-preinstall.jar";

export function resolveObjectKey(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded === "/manifest.json") {
    return MANIFEST_KEY;
  }
  if (decoded === "/remote-preinstall.jar") {
    return HELPER_KEY;
  }
  if (!decoded.startsWith("/apk/")) {
    return null;
  }

  const filename = decoded.slice("/apk/".length);
  if (
    filename.length === 0 ||
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    !/\.(apk|zip)$/i.test(filename)
  ) {
    return null;
  }
  return `apk/${filename}`;
}

function cacheControlFor(key) {
  if (key === MANIFEST_KEY) {
    return "no-cache, no-store, must-revalidate";
  }
  return "public, max-age=300, must-revalidate";
}

function responseHeaders(object, key, contentLength) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", cacheControlFor(key));
  headers.set("content-length", String(contentLength));
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

function parseSingleRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (match[1] === "" && match[2] === "") || size === 0) {
    return null;
  }

  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const length = Math.min(suffixLength, size);
    return { offset: size - length, length };
  }

  const offset = Number(match[1]);
  const requestedEnd = match[2] === "" ? size - 1 : Number(match[2]);
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(requestedEnd) ||
    offset < 0 ||
    requestedEnd < offset ||
    offset >= size
  ) {
    return null;
  }
  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1 };
}

async function serve(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  const key = resolveObjectKey(new URL(request.url).pathname);
  if (key === null) {
    return new Response("Not Found\n", { status: 404 });
  }

  const metadata = await env.APK_BUCKET.head(key);
  if (metadata === null) {
    return new Response("Not Found\n", { status: 404 });
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: responseHeaders(metadata, key, metadata.size),
    });
  }

  const rangeValue = request.headers.get("range");
  let range;
  if (rangeValue !== null) {
    range = parseSingleRange(rangeValue, metadata.size);
    if (range === null) {
      return new Response("Range Not Satisfiable\n", {
        status: 416,
        headers: {
          "accept-ranges": "bytes",
          "content-range": `bytes */${metadata.size}`,
        },
      });
    }
  }

  const object = await env.APK_BUCKET.get(
    key,
    range === undefined ? undefined : { range },
  );
  if (object === null) {
    return new Response("Not Found\n", { status: 404 });
  }

  const length = range === undefined ? object.size : range.length;
  const headers = responseHeaders(object, key, length);
  let status = 200;
  if (range !== undefined) {
    status = 206;
    headers.set(
      "content-range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`,
    );
  }
  return new Response(object.body, { status, headers });
}

export default {
  fetch(request, env) {
    return serve(request, env);
  },
};
