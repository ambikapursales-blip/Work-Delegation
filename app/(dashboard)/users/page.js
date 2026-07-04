// "use client";

// import { useState, useEffect } from "react";
// import { usersAPI } from "@/lib/api";
// import { Loading } from "@/components/loading";
// import { Mail, Building2, Edit, Trash2, Phone } from "lucide-react";

// const ROLE_STYLES = {
//   Admin: {
//     badge: "bg-[#FF6B6B]/15 text-[#FF6B6B] ring-1 ring-[#FF6B6B]/25",
//     avatar: "bg-[#FF6B6B]/10 text-[#FF6B6B]",
//     bar: "bg-[#FF6B6B]",
//   },
//   HR: {
//     badge: "bg-[#B366FF]/15 text-[#B366FF] ring-1 ring-[#B366FF]/25",
//     avatar: "bg-[#B366FF]/10 text-[#B366FF]",
//     bar: "bg-[#B366FF]",
//   },
//   Manager: {
//     badge: "bg-[#00D4FF]/15 text-[#00D4FF] ring-1 ring-[#00D4FF]/25",
//     avatar: "bg-[#00D4FF]/10 text-[#00D4FF]",
//     bar: "bg-[#00D4FF]",
//   },
//   "Sales Executive": {
//     badge: "bg-[#00FF88]/15 text-[#00FF88] ring-1 ring-[#00FF88]/25",
//     avatar: "bg-[#00FF88]/10 text-[#00FF88]",
//     bar: "bg-[#00FF88]",
//   },
//   Coordinator: {
//     badge: "bg-[#FFB84D]/15 text-[#FFB84D] ring-1 ring-[#FFB84D]/25",
//     avatar: "bg-[#FFB84D]/10 text-[#FFB84D]",
//     bar: "bg-[#FFB84D]",
//   },
// };

// const DEFAULT_STYLE = {
//   badge: "bg-white/10 text-white/60 ring-1 ring-white/10",
//   avatar: "bg-white/5 text-white/50",
//   bar: "bg-white/20",
// };

// const FILTERS = [
//   "All",
//   "Admin",
//   "HR",
//   "Manager",
//   "Sales Executive",
//   "Coordinator",
// ];

// function UserCard({ user }) {
//   const style = ROLE_STYLES[user.role] || DEFAULT_STYLE;
//   const initials = user.name
//     ?.split(" ")
//     .map((n) => n[0])
//     .slice(0, 2)
//     .join("")
//     .toUpperCase();

//   return (
//     <div className="group relative bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/[0.06] hover:border-white/[0.12] hover:shadow-glass hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col">
//       <div className={`h-1 w-full ${style.bar}`} />

//       <div className="p-5 flex flex-col flex-1">
//         <div className="flex items-start justify-between mb-4">
//           <div
//             className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${style.avatar}`}
//           >
//             {initials}
//           </div>
//           <span
//             className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${style.badge}`}
//           >
//             {user.role}
//           </span>
//         </div>

//         <h3 className="text-sm font-semibold text-white/85 mb-3 leading-snug">
//           {user.name}
//         </h3>

//         <div className="space-y-1.5 text-xs text-white/50 flex-1">
//           <div className="flex items-center gap-2 min-w-0">
//             <Mail className="w-3.5 h-3.5 shrink-0 text-white/30" />
//             <span className="truncate">{user.email}</span>
//           </div>

//           {user.department && (
//             <div className="flex items-center gap-2">
//               <Building2 className="w-3.5 h-3.5 shrink-0 text-white/30" />
//               <span>{user.department}</span>
//             </div>
//           )}

//           {user.phone && (
//             <div className="flex items-center gap-2">
//               <Phone className="w-3.5 h-3.5 shrink-0 text-white/30" />
//               <span>{user.phone}</span>
//             </div>
//           )}
//         </div>

//         <div className="mt-4 pt-4 border-t border-white/[0.06] flex gap-2">
//           <button className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white/70 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg px-3 py-2 transition-colors">
//             <Edit className="w-3.5 h-3.5" />
//             Edit
//           </button>
//           <button className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#FF6B6B] bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 rounded-lg px-3 py-2 transition-colors">
//             <Trash2 className="w-3.5 h-3.5" />
//             Delete
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function UsersPage() {
//   const [users, setUsers] = useState([]);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [activeFilter, setActiveFilter] = useState("All");

//   useEffect(() => {
//     fetchUsers();
//   }, []);

//   const fetchUsers = async () => {
//     try {
//       setLoading(true);
//       const response = await usersAPI.getAll();
//       setUsers(response.data.users || []);
//     } catch (error) {
//       console.error("Failed to fetch users:", error);
//       setError("Failed to load users. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const filtered =
//     activeFilter === "All"
//       ? users
//       : users.filter((u) => u.role === activeFilter);

//   if (loading) return <Loading />;

//   if (error) {
//     return (
//       <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
//         <p className="text-red-400">{error}</p>
//         <button
//           onClick={() => window.location.reload()}
//           className="mt-4 rounded-lg bg-[#00FF88] px-4 py-2 text-sm font-semibold text-black"
//         >
//           Retry
//         </button>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex items-end justify-between">
//         <div>
//           <h1 className="text-2xl font-bold tracking-tight text-white">
//             Team Members
//           </h1>
//           <p className="text-sm text-white/50 mt-1">
//             Manage your organisation users
//           </p>
//         </div>
//         <div className="text-right">
//           <p className="text-2xl font-bold text-white">{filtered.length}</p>
//           <p className="text-xs text-white/40 uppercase tracking-wide">
//             {activeFilter === "All" ? "Total Users" : activeFilter}
//           </p>
//         </div>
//       </div>

//       <div className="flex gap-2 flex-wrap">
//         {FILTERS.map((role) => (
//           <button
//             key={role}
//             onClick={() => setActiveFilter(role)}
//             className={`text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all ${
//               activeFilter === role
//                 ? "bg-[#00FF88] text-[#0B1220] border-[#00FF88] font-semibold"
//                 : "bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/80"
//             }`}
//           >
//             {role}
//           </button>
//         ))}
//       </div>

//       {filtered.length > 0 ? (
//         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
//           {filtered.map((user) => (
//             <UserCard key={user._id} user={user} />
//           ))}
//         </div>
//       ) : (
//         <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
//           <p className="text-sm text-white/40">No users found</p>
//         </div>
//       )}
//     </div>
//   );
// }
"use client";

import { useState, useEffect } from "react";
import { usersAPI } from "@/lib/api";
import { Loading, LoadingSpinner } from "@/components/loading";
import { Mail, Building2, Edit, Trash2, Phone, Users, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";

/* ─── Role colour tokens — accent only, no backgrounds hardcoded ─── */
const ROLE_COLORS = {
  Admin:             { accent: "var(--color-danger)",  label: "#F87171" },
  HR:                { accent: "var(--color-purple)",  label: "#A78BFA" },
  Manager:           { accent: "var(--color-info)",    label: "#60A5FA" },
  "Sales Executive": { accent: "var(--color-success)", label: "#34D399" },
  Coordinator:       { accent: "var(--color-warning)", label: "#FBBF24" },
};
const DEFAULT_COLOR = { accent: "var(--text-muted)", label: "#637A9F" };

const FILTERS = ["All", "Admin", "HR", "Manager", "Sales Executive", "Coordinator"];
const ROLES = ["Admin", "HR", "Manager", "Sales Executive", "Coordinator"];

/* ─── User Card ─────────────────────────────────────────────────── */
function UserCard({ user, onEdit, onDelete, deletingUserId }) {
  const color = ROLE_COLORS[user.role] || DEFAULT_COLOR;

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
        e.currentTarget.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Top accent bar — role colour */}
      <div
        className="h-[3px] w-full flex-shrink-0"
        style={{ background: color.label }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Avatar + badge */}
        <div className="mb-4 flex items-start justify-between">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{
              background: `color-mix(in srgb, ${color.label} 12%, transparent)`,
              color: color.label,
            }}
          >
            {initials}
          </div>

          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: `color-mix(in srgb, ${color.label} 12%, transparent)`,
              color: color.label,
              border: `1px solid color-mix(in srgb, ${color.label} 25%, transparent)`,
            }}
          >
            {user.role}
          </span>
        </div>

        {/* Name */}
        <p
          className="mb-3 text-sm font-semibold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {user.name}
        </p>

        {/* Meta */}
        <div className="flex-1 space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
          {user.department && (
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{user.department}</span>
            </div>
          )}
          {user.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{user.phone}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="mt-4 flex gap-2 border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => onEdit(user)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-card-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-muted)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>

          <button
            onClick={() => onDelete(user._id)}
            disabled={deletingUserId === user._id}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200"
            style={{
              background: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
              color: "var(--color-danger)",
              border: "1px solid color-mix(in srgb, var(--color-danger) 18%, transparent)",
              opacity: deletingUserId === user._id ? 0.6 : 1,
              cursor: deletingUserId === user._id ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (deletingUserId !== user._id) {
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 18%, transparent)";
              }
            }}
            onMouseLeave={(e) => {
              if (deletingUserId !== user._id) {
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-danger) 8%, transparent)";
              }
            }}
          >
            {deletingUserId === user._id ? (
              <>
                <LoadingSpinner size="sm" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "Sales Executive",
    department: "",
    phone: "",
    isActive: true,
  });

  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(null), 3500);
      return () => clearTimeout(t);
    }
  }, [alert]);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      setUsers(response.data.users || []);
    } catch (err) {
      setError("Failed to load team members. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      phone: user.phone || "",
      isActive: user.isActive,
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    try {
      setDeletingUserId(id);
      await usersAPI.delete(id);
      setAlert({ type: "success", msg: "User removed successfully!" });
      fetchUsers();
    } catch (err) {
      setAlert({ type: "error", msg: "Failed to remove user" });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingUser) {
        await usersAPI.update(editingUser._id, formData);
        setAlert({ type: "success", msg: "User updated successfully!" });
        setEditingUser(null);
      } else {
        await usersAPI.create(formData);
        setAlert({ type: "success", msg: "User created successfully!" });
        setShowCreateForm(false);
      }
      fetchUsers();
      resetForm();
    } catch (err) {
      setAlert({ type: "error", msg: err.response?.data?.message || "Failed to save user" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setShowCreateForm(false);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "Sales Executive",
      department: "",
      phone: "",
      isActive: true,
    });
  };

  const filtered =
    activeFilter === "All"
      ? users
      : users.filter((u) => u.role === activeFilter);

  const canCreateUser = user?.role === "Admin" || user?.role === "HR";

  if (loading) return <Loading />;

  if (showCreateForm) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Create New User
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Add a new team member to your organization
            </p>
          </div>
          <button
            onClick={resetForm}
            className="rounded-lg p-2 transition-colors"
            style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input-field"
                required
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active User
              </Label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" loading={isSubmitting} loadingText={editingUser ? "Saving..." : "Creating..."}>
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (editingUser) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Edit User
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Update user permissions and information
            </p>
          </div>
          <button
            onClick={resetForm}
            className="rounded-lg p-2 transition-colors"
            style={{ background: "var(--bg-muted)", color: "var(--text-secondary)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input-field"
                required
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active User
              </Label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" loading={isSubmitting} loadingText="Saving...">
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: "color-mix(in srgb, var(--color-danger) 6%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-danger) 18%, transparent)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-4 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Team Members
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Manage your organisation users
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreateUser && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          )}
          <div
            className="flex flex-col items-end rounded-xl px-4 py-3"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {filtered.length}
            </span>
            <span
              className="text-[11px] uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              {activeFilter === "All" ? "Total" : activeFilter}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((role) => {
          const active = activeFilter === role;
          return (
            <button
              key={role}
              onClick={() => setActiveFilter(role)}
              className="rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200"
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, var(--active-start) 0%, var(--active-end) 100%)",
                      color: "var(--active-text)",
                      border: "1px solid var(--active-end)",
                      fontWeight: 600,
                    }
                  : {
                      background: "var(--bg-muted)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.borderColor = "var(--border-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }
              }}
            >
              {role}
            </button>
          );
        })}
      </div>

      {/* ── Grid / Empty ── */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((user) => (
            <UserCard key={user._id} user={user} onEdit={handleEdit} onDelete={handleDelete} deletingUserId={deletingUserId} />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--bg-muted)" }}
          >
            <Users className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            No users found
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {activeFilter !== "All"
              ? `No ${activeFilter} members yet`
              : "Add your first team member to get started"}
          </p>
        </div>
      )}

      {alert && <Toast type={alert.type} message={alert.msg} />}
    </div>
  );
}