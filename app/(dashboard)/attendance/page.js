"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";
import { attendanceAPI } from "@/lib/api";

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("month");

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getAll();
      setRecords(response.data?.records || []);
    } catch (err) {
      setError("Failed to load attendance records");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkAttendance = async () => {
    try {
      setError("");
      setSuccess("");
      await attendanceAPI.mark({
        date: new Date(),
        status: "Present",
      });
      setSuccess("Attendance marked successfully!");
      fetchAttendance();
    } catch (err) {
      setError("Failed to mark attendance");
    }
  };

  const presentCount = records.filter((r) => r.status === "Present").length;
  const absentCount = records.filter((r) => r.status === "Absent").length;
  const totalDays = records.length;
  const attendancePercentage =
    totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

  const isHROrAdmin = ["HR", "Admin"].includes(user?.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white/85">Attendance</h1>
        <p className="text-white/50 mt-1">
          Your attendance records and statistics
        </p>
      </div>

      {error && (
        <Alert className="bg-white/[0.04] backdrop-blur-xl border-red-500/30">
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-white/[0.04] backdrop-blur-xl border-[#00FF88]/30">
          <AlertDescription className="text-[#00FF88]">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs text-white/50 font-medium">
                Present Days
              </p>
              <p className="text-3xl font-bold text-[#00FF88]">
                {presentCount}
              </p>
              <p className="text-xs text-white/50">days present</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs text-white/50 font-medium">
                Absent Days
              </p>
              <p className="text-3xl font-bold text-[#FF6B6B]">{absentCount}</p>
              <p className="text-xs text-white/50">days absent</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs text-white/50 font-medium">
                Total Days
              </p>
              <p className="text-3xl font-bold text-white/85">{totalDays}</p>
              <p className="text-xs text-white/50">record days</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs text-[#00D4FF] font-medium">Attendance %</p>
              <p className="text-3xl font-bold text-[#00D4FF]">
                {attendancePercentage}%
              </p>
              <p className="text-xs text-[#00D4FF]/80">of working days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mark Attendance Button */}
      {!isHROrAdmin && (
        <Card className="bg-white/[0.04] backdrop-blur-xl border border-[#00FF88]/30 rounded-2xl shadow-glass-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#00FF88]">
                  Mark Today&apos;s Attendance
                </h3>
                <p className="text-sm text-white/60 mt-1">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Button
                onClick={handleMarkAttendance}
                className="bg-gradient-to-r from-[#00FF88] to-[#00CC70] text-[#0B1220] hover:opacity-90"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Present
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Records */}
      <Card className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-glass-sm">
        <CardHeader>
          <CardTitle className="text-white/85">Attendance History</CardTitle>
          <CardDescription className="text-white/50">Your daily attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-white/50">
              Loading records...
            </p>
          ) : records.length === 0 ? (
            <Alert className="bg-white/[0.04] backdrop-blur-xl border-white/[0.08]">
              <AlertDescription className="text-white/50">No attendance records yet</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {records.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    {record.status === "Present" ? (
                      <CheckCircle2 className="h-5 w-5 text-[#00FF88]" />
                    ) : (
                      <XCircle className="h-5 w-5 text-[#FF6B6B]" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white/85">
                        {new Date(record.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {record.loginTime && (
                        <p className="text-xs text-white/50">
                          Login:{" "}
                          {new Date(record.loginTime).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={
                      record.status === "Present"
                        ? "bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/25"
                        : "bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25"
                    }
                  >
                    {record.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
