const jwt = require("jsonwebtoken");
const http = require("http");

const token = jwt.sign(
  { id: "6a51de5ff0320e0f3c4088b0" },
  "your_super_secret_jwt_key_change_this_in_production",
  { expiresIn: "7d" },
);

const taskId = "6a5b05a9053c858a67009f40";
const body = JSON.stringify({
  status: "completed",
  completionProof: "Test completion by Super Admin",
});

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/tasks/" + taskId,
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = http.request(options, (res) => {
  console.log("STATUS:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    try {
      console.log("BODY:", JSON.parse(data));
    } catch {
      console.log("RAW:", data.substring(0, 500));
    }
  });
});
req.on("error", (e) => console.error("ERROR:", e.message));
req.write(body);
req.end();
