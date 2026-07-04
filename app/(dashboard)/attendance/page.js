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
import { LoadingSpinner } from "@/components/loading";

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("month");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkAttendance = async () => {
    try {
      setError("");
      setSuccess("");
      setIsSubmitting(true);
      await attendanceAPI.mark({
        date: new Date(),
        status: "Present",
      });
      setSuccess("Attendance marked successfully!");
      fetchAttendance();
    } catch (err) {
      setError("Failed to mark attendance");
    } finally {
      setIsSubmitting(false);
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
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Attendance</h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Your attendance records and statistics
        </p>
      </div>

      {error && (
        <Alert style={{
          backgroundColor: "var(--bg-muted)",
          borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
          color: "var(--color-danger)",
        }}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert style={{
          backgroundColor: "var(--bg-muted)",
          borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
          color: "var(--color-success)",
        }}>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}>
                Present Days
              </p>
              <p className="text-3xl font-bold"
                style={{ color: "var(--color-success)" }}>
                {presentCount}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>days present</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}>
                Absent Days
              </p>
              <p className="text-3xl font-bold"
                style={{ color: "var(--color-danger)" }}>{absentCount}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>days absent</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}>
                Total Days
              </p>
              <p className="text-3xl font-bold"
                style={{ color: "var(--text-primary)" }}>{totalDays}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>record days</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs font-medium"
                style={{ color: "var(--color-info)" }}>Attendance %</p>
              <p className="text-3xl font-bold"
                style={{ color: "var(--color-info)" }}>
                {attendancePercentage}%
              </p>
              <p className="text-xs" style={{ color: "var(--color-info)" }}>of working days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mark Attendance Button */}
      {!isHROrAdmin && (
        <Card className="border"
          style={{
            borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
          }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold"
                  style={{ color: "var(--color-success)" }}>
                  Mark Today&apos;s Attendance
                </h3>
                <p className="text-sm mt-1"
                  style={{ color: "var(--text-secondary)" }}>
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
                loading={isSubmitting}
                loadingText="Marking..."
                style={{
                  background: "linear-gradient(135deg, var(--color-success) 0%, color-mix(in srgb, var(--color-success) 75%, var(--bg-base)) 100%)",
                  color: "var(--text-inverse)",
                  boxShadow: "0 2px 8px color-mix(in srgb, var(--color-success) 30%, transparent)",
                }}
              >
                Mark Present
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>Your daily attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center" style={{ color: "var(--text-secondary)" }}>
              Loading records...
            </p>
          ) : records.length === 0 ? (
            <Alert style={{
              backgroundColor: "var(--bg-muted)",
              borderColor: "var(--border)",
            }}>
              <AlertDescription style={{ color: "var(--text-secondary)" }}>No attendance records yet</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {records.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: "var(--bg-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {record.status === "Present" ? (
                      <CheckCircle2 className="h-5 w-5" style={{ color: "var(--color-success)" }} />
                    ) : (
                      <XCircle className="h-5 w-5" style={{ color: "var(--color-danger)" }} />
                    )}
                    <div>
                      <p className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}>
                        {new Date(record.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {record.loginTime && (
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          Login:{" "}
                          {new Date(record.loginTime).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    style={
                      record.status === "Present"
                        ? {
                            backgroundColor: "color-mix(in srgb, var(--color-success) 12%, transparent)",
                            color: "var(--color-success)",
                            border: "1px solid color-mix(in srgb, var(--color-success) 22%, transparent)",
                          }
                        : {
                            backgroundColor: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                            color: "var(--color-danger)",
                            border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
                          }
                    }
                    className="rounded-full"
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
