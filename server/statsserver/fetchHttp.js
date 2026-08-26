import https from "https";
import http from "http";

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function httpGet(url, { timeoutMs = 15000, insecure = false } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const port = parsed.port || (isHttps ? 443 : 80);

    const opts = {
      hostname: parsed.hostname,
      port,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "agar-statsserver/1.0",
      },
      timeout: timeoutMs,
    };

    if (isHttps) {
      opts.agent = insecure ? insecureAgent : undefined;
      if (insecure) opts.rejectUnauthorized = false;
    }

    const req = lib.request(opts, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve({ status: res.statusCode, body });
      });
    });

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export { httpGet };
