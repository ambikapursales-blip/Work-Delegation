import { NextResponse } from "next/server";
import {
  createReq,
  createRes,
  finishRes,
  parseBody,
  ensureDbConnection,
  requireAuth,
} from "@/src/lib/route-adapter";
import Message from "@/src/models/Message";
import { canEditMessage, canDeleteMessage } from "@/src/utils/conversationAuth";

export async function PUT(request, { params }) {
  const res = createRes();
  await parseBody(request);
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;

  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return finishRes(res.status(404).json({ success: false, message: "Message not found" }));
    }

    const authorized = await canEditMessage(user, message);
    if (!authorized) {
      return finishRes(res.status(403).json({ success: false, message: "Not authorized to edit this message" }));
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return finishRes(res.status(400).json({ success: false, message: "Message text is required" }));
    }

    message.text = text;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id)
      .populate("sender", "name email role avatar")
      .populate("parentId", "text type sender")
      .lean();

    return finishRes(res.status(200).json({ success: true, data: populated }));
  } catch (error) {
    return finishRes(res.status(500).json({ success: false, message: "Server error" }));
  }
}

export async function DELETE(request, { params }) {
  const res = createRes();
  await ensureDbConnection();
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;
  const req = createReq(request, params);
  req.user = user;

  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return finishRes(res.status(404).json({ success: false, message: "Message not found" }));
    }

    const authorized = await canDeleteMessage(user, message);
    if (!authorized) {
      return finishRes(res.status(403).json({ success: false, message: "Not authorized to delete this message" }));
    }

    message.isDeleted = true;
    await message.save();

    return finishRes(res.status(200).json({ success: true, message: "Message deleted" }));
  } catch (error) {
    return finishRes(res.status(500).json({ success: false, message: "Server error" }));
  }
}
