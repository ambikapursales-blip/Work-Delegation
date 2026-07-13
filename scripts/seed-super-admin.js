import mongoose from "mongoose";
import User from "../src/models/User.js";
import dotenv from "dotenv";
// LOCAL DEVELOPMENT ONLY: bcrypt not needed for plaintext passwords
// REVERT BEFORE PRODUCTION
// import bcrypt from "bcryptjs";
dotenv.config();

const seedSuperAdmin = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB successfully");

    const email = "alokpatel0808@gmail.com";

    // Remove existing user so we can re-create with a correctly hashed password
    console.log(`Checking if user with email ${email} exists...`);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(
        `User with email ${email} already exists. Deleting and re-creating to fix password hash...`,
      );
      await User.deleteOne({ _id: existingUser._id });
      console.log("Existing user deleted.");
    }

    console.log("Creating Super Admin user...");

    // Check if EMP001 is already taken, if so find next available
    let employeeId = "EMP001";
    const existingEmployeeId = await User.findOne({ employeeId });
    if (existingEmployeeId) {
      console.log("EMP001 is already taken. Finding next available employee ID...");
      const users = await User.find({ employeeId: { $regex: /^EMP\d+$/ } })
        .select("employeeId")
        .lean();
      let maxNum = 0;
      for (const u of users) {
        const num = parseInt(u.employeeId.replace("EMP", ""), 10);
        if (num > maxNum) maxNum = num;
      }
      employeeId = `EMP${String(maxNum + 1).padStart(4, "0")}`;
      console.log(`Using employee ID: ${employeeId}`);
    }

    // LOCAL DEVELOPMENT ONLY: Pass plaintext password (no hashing)
    // REVERT BEFORE PRODUCTION
    const superAdmin = new User({
      name: "Alok Patel",
      email: email,
      password: "Alok123", // PLAINTEXT FOR LOCAL DEV
      role: "Super Admin",
      department: "Management",
      employeeId: employeeId,
      isActive: true,
      canAssignTasks: true,
      canViewAllTasks: true,
      joinDate: new Date(),
    });

    await superAdmin.save();
    console.log("Super Admin user created successfully!");
    console.log("User details:", {
      name: superAdmin.name,
      email: superAdmin.email,
      role: superAdmin.role,
      employeeId: superAdmin.employeeId,
      isActive: superAdmin.isActive,
      canAssignTasks: superAdmin.canAssignTasks,
      canViewAllTasks: superAdmin.canViewAllTasks,
    });

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    console.log("Seed script completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during seed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedSuperAdmin();
