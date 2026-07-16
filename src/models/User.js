import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["Super Admin", "Admin", "Logistics", "Accounts", "Sales", "Service", "Parts", "HR", "Marketing", "Back Office"],
      default: "Sales",
    },
    department: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    canAssignTasks: {
      type: Boolean,
      default: false,
    },
    canViewAllTasks: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    lastActive: {
      type: Date,
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
      updatedAt: Date,
    },
    performanceScore: {
      type: Number,
      default: 0,
    },
    grade: {
      type: String,
      enum: ["A+", "A", "B+", "B", "C", "D", "F", ""],
      default: "",
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    resetPasswordAttempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// LOCAL DEVELOPMENT ONLY: Password hashing disabled for development
// REVERT BEFORE PRODUCTION
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  // this.password = await bcrypt.hash(this.password, 12); // DISABLED FOR LOCAL DEV
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isNew) return next();
  if (!this.employeeId) {
    const users = await this.constructor
      .find({ employeeId: { $regex: /^EMP\d+$/ } })
      .select("employeeId")
      .lean();
    let maxNum = 0;
    for (const u of users) {
      const num = parseInt(u.employeeId.replace("EMP", ""), 10);
      if (num > maxNum) maxNum = num;
    }
    this.employeeId = `EMP${String(maxNum + 1).padStart(4, "0")}`;
  }
  next();
});

// LOCAL DEVELOPMENT ONLY: Password comparison disabled for development
// REVERT BEFORE PRODUCTION
userSchema.methods.comparePassword = async function (candidatePassword) {
  // return await bcrypt.compare(candidatePassword, this.password); // DISABLED FOR LOCAL DEV
  return candidatePassword === this.password; // PLAINTEXT COMPARISON FOR LOCAL DEV
};

userSchema.methods.getPublicProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  delete userObject.resetPasswordAttempts;
  return userObject;
};

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ managerId: 1 });
userSchema.index({ name: 1 });
userSchema.index({ isActive: 1, role: 1 });

export default mongoose.models?.User || mongoose.model("User", userSchema);
