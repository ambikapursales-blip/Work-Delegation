import User from "../models/User.js";
import Activity from "../models/Activity.js";
import Attendance from "../models/Attendance.js";
import { generateToken } from "../middleware/auth.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide email and password",
        });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Account is deactivated. Contact admin.",
        });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false });

    await Activity.create({
      user: user._id,
      type: "login",
      description: `${user.name} logged in`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Attendance.findOneAndUpdate(
      { employee: user._id, date: today },
      {
        $setOnInsert: {
          employee: user._id,
          date: today,
          loginTime: new Date(),
          status: "Present",
        },
      },
      { upsert: true, new: true },
    );

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during login" });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, department, phone, managerId } =
      req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "Sales Executive",
      department,
      phone,
      managerId,
    });

    if (req.user) {
      await Activity.create({
        user: req.user._id,
        type: "user_created",
        description: `New user ${user.name} created with role ${user.role}`,
        entityId: user._id,
        entityType: "User",
      });
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error("Register error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "Server error during registration",
      });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "managerId",
      "name email role",
    );
    res.status(200).json({ success: true, user: user.getPublicProfile() });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Attendance.findOneAndUpdate(
      { employee: req.user._id, date: today },
      { logoutTime: new Date() },
    );

    await Activity.create({
      user: req.user._id,
      type: "logout",
      description: `${req.user.name} logged out`,
      ipAddress: req.ip,
    });

    res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, department } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, department },
      { new: true, runValidators: true },
    );

    await Activity.create({
      user: req.user._id,
      type: "profile_updated",
      description: `${req.user.name} updated their profile`,
    });

    res.status(200).json({ success: true, user: user.getPublicProfile() });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    await Activity.create({
      user: req.user._id,
      type: "password_changed",
      description: `${req.user.name} changed their password`,
    });

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      location: { lat, lng, address, updatedAt: new Date() },
    });

    res.status(200).json({ success: true, message: "Location updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
