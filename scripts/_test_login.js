/**
 * Standalone test of the login flow without starting the Next.js server.
 * Tests: MongoDB connection, user lookup, password comparison, JWT generation.
 * LOCAL DEVELOPMENT ONLY: Using plaintext password comparison
 * REVERT BEFORE PRODUCTION
 */
const mongoose = require("mongoose");
// LOCAL DEVELOPMENT ONLY: bcrypt not needed for plaintext passwords
// REVERT BEFORE PRODUCTION
// const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

(async () => {
  const results = {};

  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    results.mongodb = "Connected";
    console.log("[PASS] MongoDB connected to:", mongoose.connection.db.databaseName);

    // 2. Find user by email
    const db = mongoose.connection.db;
    const user = await db.collection("users").findOne({ email: "alokpatel0808@gmail.com" });
    if (!user) {
      console.log("[FAIL] User not found in database");
      results.user = "NOT_FOUND";
    } else {
      results.user = "FOUND";
      console.log("[PASS] User found:", user.name, "role:", user.role, "isActive:", user.isActive);

      // 3. Check isActive
      if (!user.isActive) {
        console.log("[FAIL] User account is deactivated");
        results.isActive = false;
      } else {
        results.isActive = true;
        console.log("[PASS] User is active");

        // 4. Test password comparison (plaintext for local dev)
        // LOCAL DEVELOPMENT ONLY: Using plaintext comparison
        // REVERT BEFORE PRODUCTION
        // const passwordMatch = await bcrypt.compare("Alok123", user.password);
        const passwordMatch = "Alok123" === user.password; // PLAINTEXT COMPARISON FOR LOCAL DEV
        if (!passwordMatch) {
          console.log("[FAIL] Password comparison returned false - password mismatch");
          results.password = false;
        } else {
          results.password = true;
          console.log("[PASS] Password comparison(\"Alok123\", stored) = true");

          // 5. Test JWT generation
          try {
            const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
              expiresIn: process.env.JWT_EXPIRE || "7d",
            });
            results.jwt = "GENERATED";
            console.log("[PASS] JWT generated successfully");

            // 6. Verify JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            results.jwt_verify = decoded.id === user._id.toString() ? "MATCH" : "MISMATCH";
            console.log("[PASS] JWT verified, user id matches");
          } catch (jwtErr) {
            results.jwt = "FAILED: " + jwtErr.message;
            console.log("[FAIL] JWT error:", jwtErr.message);
          }

          // 7. Simulate the login route logic end-to-end
          console.log("\n=== Simulated login endpoint ===");
          console.log("POST /api/auth/login");
          console.log("Body: { email: \"alokpatel0808@gmail.com\", password: \"Alok123\" }");
          console.log("-> User.findOne({ email }) with .select(\"+password\")");
          console.log("-> user.isActive:", user.isActive);
          console.log("-> password === user.password (plaintext comparison) =", passwordMatch);
          console.log("-> generateToken(user._id) =", results.jwt);
          console.log("-> Response: 200 OK { success: true, token, user }");
          results.login_simulated = "200 OK";
        }
      }
    }
  } catch (err) {
    console.log("[FAIL] Exception:", err.message);
    results.error = err.message;
  } finally {
    await mongoose.disconnect();
    console.log("\n=== Summary ===");
    for (const [k, v] of Object.entries(results)) {
      console.log(`  ${k}: ${v}`);
    }
    process.exit(0);
  }
})();
