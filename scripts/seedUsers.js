import mongoose from "mongoose";
import User from "../src/models/User.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await User.deleteMany({});
    console.log("Cleared existing users");

    const users = [
      {
        name: "Amol Dahake",
        email: "admin@deepsikha.in",
        password: "Amol@123",
        role: "Admin",
        department: "Management",
        phone: "8959860000",
        employeeId: "EMP001",
      },
      {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        role: "Sales Executive",
        department: "Sales",
        phone: "9000000002",
        employeeId: "EMP002",
      },
      {
        name: "Mayuri Tiwari",
        email: "myuri.tiwari@deepsikha.in",
        password: "mayuri123",
        role: "Manager",
        department: "Sales",
        phone: "8959002777",
        employeeId: "EMP003",
      },
      {
        name: "Anjali Sharma",
        email: "hr@deepsikha.in",
        password: "anjali123",
        role: "HR",
        department: "Human Resources",
        phone: "8959000737",
        employeeId: "EMP004",
      },
      {
        name: "Deepika Sahu",
        email: "coordinator@deepsikha.in",
        password: "deepika123",
        role: "Coordinator",
        department: "Operations",
        phone: "8959381577",
        employeeId: "EMP005",
      },
      {
        name: "Pratiksmith Khamari",
        email: "dme@deepsikha.in",
        password: "pratik123",
        role: "It",
        department: "It",
        phone: "8959317196",
        employeeId: "EMP006",
      },
    ];

    const createdUsers = [];
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }

    console.log(`Created ${createdUsers.length} test users`);

    createdUsers.forEach((user) => {
      console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedUsers();
