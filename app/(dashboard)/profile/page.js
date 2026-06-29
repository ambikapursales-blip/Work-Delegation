"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { authAPI } from "@/lib/api";
import { Loading } from "@/components/loading";
import { Edit, CheckCircle, X } from "lucide-react";

const ROLE_STYLES = {
  Admin: { color: "var(--color-danger)", bg: "var(--color-danger)" },
  HR: { color: "var(--color-purple)", bg: "var(--color-purple)" },
  Manager: { color: "var(--color-info)", bg: "var(--color-info)" },
  "Sales Executive": { color: "var(--primary)", bg: "var(--primary)" },
  Coordinator: { color: "var(--color-warning)", bg: "var(--color-warning)" },
};

const AVATAR_GRADIENTS = {
  Admin: "from-[#FF6B6B] to-[#FF4444]",
  HR: "from-[#B366FF] to-[#9933FF]",
  Manager: "from-[#00D4FF] to-[#0099CC]",
  "Sales Executive": "from-[#1E3A8A] to-[#2563EB]",
  Coordinator: "from-[#FFB84D] to-[#FF9500]",
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
    avatar: user?.avatar || "",
  });
  const [message, setMessage] = useState("");

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.updateProfile(formData);
      await refreshUser();
      setMessage("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Loading />;

  const roleStyle = ROLE_STYLES[user.role] || { color: "var(--text-secondary)", bg: "var(--text-muted)" };
  const avatarGradient = AVATAR_GRADIENTS[user.role] || "from-white/30 to-white/10";
  const isSuccess = message.includes("successfully");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Profile
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Manage and update your account information
          </p>
        </div>

        {message && (
          <div
            className="mb-6 p-4 rounded-xl border-l-4 flex items-center gap-3 transition-all duration-300 backdrop-blur-xl"
            style={{
              backgroundColor: "var(--bg-muted)",
              borderLeftColor: isSuccess ? "var(--color-success)" : "var(--color-danger)",
            }}
          >
            {isSuccess ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: "var(--color-success)" }} />
            ) : (
              <X className="h-5 w-5 flex-shrink-0" style={{ color: "var(--color-danger)" }} />
            )}
            <p className="font-medium" style={{ color: isSuccess ? "var(--color-success)" : "var(--color-danger)" }}>{message}</p>
          </div>
        )}

        <div
          className="backdrop-blur-xl rounded-2xl shadow-glass-sm overflow-hidden"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div
            className="px-6 md:px-8 py-6 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                Personal Information
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Update your profile details and settings
              </p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200"
              style={isEditing ? {
                backgroundColor: "var(--bg-muted)",
                color: "var(--text-primary)",
              } : {
                backgroundColor: "color-mix(in srgb, var(--color-info) 10%, transparent)",
                color: "var(--color-info)",
                border: "1px solid color-mix(in srgb, var(--color-info) 25%, transparent)",
              }}
            >
              {isEditing ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  Edit
                </>
              )}
            </button>
          </div>

          <div className="px-6 md:px-8 py-8">
            {!isEditing ? (
              <div className="space-y-8">
                <div
                  className="flex items-center gap-6 pb-8"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-4xl font-bold shadow-lg bg-avatar`}
                  >
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                      {user.name}
                    </h3>
                    <div className="mt-2">
                      <Badge
                        className="text-sm font-medium px-3 py-1"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${roleStyle.bg} 15%, transparent)`,
                          color: roleStyle.color,
                          borderColor: `color-mix(in srgb, ${roleStyle.bg} 25%, transparent)`,
                        }}
                      >
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Email Address
                    </p>
                    <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                      {user.email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Phone Number
                    </p>
                    <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                      {user.phone || (
                        <span style={{ color: "var(--text-muted)" }}>Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Department
                    </p>
                    <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                      {user.department || (
                        <span style={{ color: "var(--text-muted)" }}>Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Employee ID
                    </p>
                    <p className="text-lg font-medium font-mono" style={{ color: "var(--text-primary)" }}>
                      {user.employeeId}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Join Date
                    </p>
                    <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                      {new Date(user.joinDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-sm font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="rounded-xl px-4 py-2.5"
                      style={{
                        backgroundColor: "var(--bg-input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="rounded-xl px-4 py-2.5 cursor-not-allowed"
                      style={{
                        backgroundColor: "var(--bg-muted)",
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-sm font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="rounded-xl px-4 py-2.5"
                      style={{
                        backgroundColor: "var(--bg-input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="department"
                      className="text-sm font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Department
                    </Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      className="rounded-xl px-4 py-2.5"
                      style={{
                        backgroundColor: "var(--bg-input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      placeholder="e.g., Engineering, Sales"
                    />
                  </div>
                </div>

                <div
                  className="flex gap-3 justify-end pt-6"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 rounded-xl font-medium transition-colors duration-200"
                    style={{
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--bg-muted)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                      color: "var(--active-text)",
                    }}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
