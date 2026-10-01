const http = require("node:http");
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  email: "member@example.invalid",
  email_confirmed_at: "2026-10-01T00:00:00Z",
  user_metadata: { interests: ["sports", "markets"] },
};
http
  .createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    if (req.url.startsWith("/auth/v1/user")) {
      res.end(JSON.stringify(user));
      return;
    }
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "Local mock: endpoint disabled" }));
  })
  .listen(4010, "127.0.0.1");
