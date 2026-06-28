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

  const roleColors = {
    Admin: "bg-[#FF6B6B]/15 text-[#FF6B6B] border border-[#FF6B6B]/25",
    HR: "bg-[#B366FF]/15 text-[#B366FF] border border-[#B366FF]/25",
    Manager: "bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/25",
    "Sales Executive":
      "bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/25",
    Coordinator: "bg-[#FFB84D]/15 text-[#FFB84D] border border-[#FFB84D]/25",
  };

  const getRoleColor = (role) => {
    return (
      roleColors[role] || "bg-white/10 text-white/60 border border-white/10"
    );
  };

  const getInitialBgColor = (role) => {
    const colorMap = {
      Admin: "from-[#FF6B6B] to-[#FF4444]",
      HR: "from-[#B366FF] to-[#9933FF]",
      Manager: "from-[#00D4FF] to-[#0099CC]",
      "Sales Executive": "from-[#00FF88] to-[#00CC70]",
      Coordinator: "from-[#FFB84D] to-[#FF9500]",
    };
    return colorMap[role] || "from-white/30 to-white/10";
  };

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
            Profile
          </h1>
          <p className="text-base text-white/50">
            Manage and update your account information
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border-l-4 flex items-center gap-3 transition-all duration-300 bg-white/[0.04] backdrop-blur-xl ${
              message.includes("successfully")
                ? "border-l-[#00FF88]"
                : "border-l-[#FF6B6B]"
            }`}
          >
            {message.includes("successfully") ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-[#00FF88]" />
            ) : (
              <X className="h-5 w-5 flex-shrink-0 text-[#FF6B6B]" />
            )}
            <p className={`font-medium ${message.includes("successfully") ? "text-[#00FF88]" : "text-[#FF6B6B]"}`}>{message}</p>
          </div>
        )}

        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl shadow-glass-sm border border-white/[0.06] overflow-hidden">
          <div className="bg-white/[0.02] px-6 md:px-8 py-6 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Personal Information
              </h2>
              <p className="text-white/50 text-sm mt-1">
                Update your profile details and settings
              </p>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isEditing
                  ? "bg-white/[0.08] text-white hover:bg-white/[0.12]"
                  : "bg-[#00D4FF]/10 text-[#00D4FF] hover:bg-[#00D4FF]/20 border border-[#00D4FF]/25"
              }`}
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
                <div className="flex items-center gap-6 pb-8 border-b border-white/[0.06]">
                  <div
                    className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${getInitialBgColor(
                      user.role,
                    )} flex items-center justify-center text-white text-4xl font-bold shadow-lg`}
                  >
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-white">
                      {user.name}
                    </h3>
                    <div className="mt-2">
                      <Badge
                        className={`${getRoleColor(
                          user.role,
                        )} text-sm font-medium px-3 py-1`}
                      >
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/40 uppercase tracking-wider">
                      Email Address
                    </p>
                    <p className="text-lg text-white font-medium">
                      {user.email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/40 uppercase tracking-wider">
                      Phone Number
                    </p>
                    <p className="text-lg text-white font-medium">
                      {user.phone || (
                        <span className="text-white/30">Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/40 uppercase tracking-wider">
                      Department
                    </p>
                    <p className="text-lg text-white font-medium">
                      {user.department || (
                        <span className="text-white/30">Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/40 uppercase tracking-wider">
                      Employee ID
                    </p>
                    <p className="text-lg text-white font-medium font-mono">
                      {user.employeeId}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/40 uppercase tracking-wider">
                      Join Date
                    </p>
                    <p className="text-lg text-white font-medium">
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
                      className="text-sm font-medium text-white/80"
                    >
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="rounded-xl bg-white/[0.05] border-white/[0.1] px-4 py-2.5 text-white placeholder-white/40"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-white/80"
                    >
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="rounded-xl bg-white/[0.03] border-white/[0.06] px-4 py-2.5 text-white/50 cursor-not-allowed"
                    />
                    <p className="text-xs text-white/40">
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-sm font-medium text-white/80"
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="rounded-xl bg-white/[0.05] border-white/[0.1] px-4 py-2.5 text-white placeholder-white/40"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="department"
                      className="text-sm font-medium text-white/80"
                    >
                      Department
                    </Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      className="rounded-xl bg-white/[0.05] border-white/[0.1] px-4 py-2.5 text-white placeholder-white/40"
                      placeholder="e.g., Engineering, Sales"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-6 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 rounded-xl font-medium text-white/70 bg-white/[0.05] hover:bg-white/[0.1] transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl font-medium text-[#0B1220] bg-gradient-to-r from-[#00FF88] to-[#00CC70] hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-white/30">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
