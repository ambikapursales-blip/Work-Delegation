import jwt from "jsonwebtoken";
import http from "http";

const token = jwt.sign(
  { id: "6a51de5ff0320e0f3c4088b0" },
  "your_super_secret_jwt_key_change_this_in_production",
  { expiresIn: "7d" },
);

// Test 1: Try to complete a task that SA created (should work)
const taskId = "6a5b05a9053c858a67009f40";
const body = JSON.stringify({
  status: "completed",
  completionProof: "Test proof from API",
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
  console.log("Status:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => console.log("Body:", data));
});
req.on("error", (e) => console.error("Error:", e.message));
req.write(body);
req.end();
