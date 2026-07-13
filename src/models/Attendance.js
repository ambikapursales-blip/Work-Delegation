import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    loginTime: {
      type: Date,
    },
    logoutTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Leave", "Holiday", ""],
      default: "Present",
    },
    workingHours: {
      type: Number,
      default: 0,
    },
    remarks: {
      type: String,
      trim: true,
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
    ipAddress: String,
    deviceInfo: String,
  },
  {
    timestamps: true,
  },
);

attendanceSchema.index({ employee: 1, date: 1 });
attendanceSchema.index({ date: 1, status: 1 });
export default mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
