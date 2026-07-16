import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "Meeting",
        "Training",
        "Workshop",
        "Conference",
        "Team Building",
        "Other",
      ],
      default: "Meeting",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      trim: true,
    },
    isVirtual: {
      type: Boolean,
      default: false,
    },
    meetingLink: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: [
      {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: ["Pending", "Accepted", "Declined", "Attended", "Absent"],
          default: "Pending",
        },
        remarks: String,
      },
    ],
    status: {
      type: String,
      enum: ["Upcoming", "Ongoing", "Completed", "Cancelled"],
      default: "Upcoming",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    tags: [String],
    attachments: [
      {
        name: String,
        url: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

eventSchema.index({ startDate: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ "assignedTo.employee": 1, status: 1 });

export default mongoose.models?.Event || mongoose.model("Event", eventSchema);
