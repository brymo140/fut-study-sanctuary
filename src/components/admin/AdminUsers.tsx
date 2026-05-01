import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Shield, Ban, Trash2, Crown } from "lucide-react";
import { SectionHeader, inputClass, TableShell, Th, Td, ActionBtn, EmptyRow } from "./ui";
import { isHardcodedAdminEmail } from "@/contexts/AuthContext";
import { getDatabaseErrorMessage, withSchemaRetry } from "@/lib/supabaseRetry";

interface Profile {
  id: string; full_name: string; email: string; level: string | null; department: string | null;
  matric_no: string | null; xp: number; streak: number; created_at: string; is_banned: boolean;
}
interface RoleRow { user_id: string; role: "admin" | "rep" | "student" }

const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];
const ROLES = ["All", "admin", "rep", "student"];

export const AdminUsers = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [viewing, setViewing] = useState<Profile | null>(null);

  const reload = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,level,department,matric_no,xp,streak,created_at,is_banned").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setUsers((p || []) as Profile[]);
    const map: Record<string, string[]> = {};
    ((r || []) as RoleRow[]).forEach((x) => {
      map[x.user_id] = [...(map[x.user_id] || []), x.role];
    });
    setRoles(map);
  };
  useEffect(() => { reload(); }, []);

  const promote = async (u: Profile) => {
    const has = (roles[u.id] || []).includes("rep");
    if (has) { toast.info("Already a class rep"); return; }
    const { error } = await withSchemaRetry(async () => await supabase.from("user_roles").insert({ user_id: u.id, role: "rep" }));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    toast.success("Promoted to class rep");
    reload();
  };

  const toggleAdmin = async (u: Profile) => {
    const isAdmin = (roles[u.id] || []).includes("admin");
    if (isAdmin) {
      if (isHardcodedAdminEmail(u.email)) {
        toast.error("This admin is permanent and cannot be demoted.");
        return;
      }
      if (!confirm(`Demote ${u.full_name || u.email} from admin?`)) return;
      const { error } = await withSchemaRetry(async () => await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin"));
      if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
      toast.success("Admin role removed");
    } else {
      if (!confirm(`Promote ${u.full_name || u.email} to admin? They will get full /admin access on next login.`)) return;
      const { error } = await withSchemaRetry(async () => await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" }));
      if (error && error.code !== "23505") { toast.error(getDatabaseErrorMessage(error)); return; }
      toast.success("Promoted to admin");
    }
    reload();
  };

  const toggleBan = async (u: Profile) => {
    if (isHardcodedAdminEmail(u.email)) {
      toast.error("Permanent admins cannot be banned.");
      return;
    }
    const { error } = await withSchemaRetry(async () => await supabase.from("profiles").update({ is_banned: !u.is_banned }).eq("id", u.id));
    if (error) { toast.error(getDatabaseErrorMessage(error)); return; }
    toast.success(u.is_banned ? "User unbanned" : "User banned");
    reload();
  };

  const remove = async (u: Profile) => {
    if (!confirm(`Permanently remove ${u.full_name || u.email}? Their auth record stays but their profile is wiped.`)) return;
    const rolesDelete = await withSchemaRetry(async () => await supabase.from("user_roles").delete().eq("user_id", u.id));
    if (rolesDelete.error) { toast.error(getDatabaseErrorMessage(rolesDelete.error)); return; }
    const profileDelete = await withSchemaRetry(async () => await supabase.from("profiles").delete().eq("id", u.id));
    if (profileDelete.error) { toast.error(getDatabaseErrorMessage(profileDelete.error)); return; }
    toast.success("Profile removed");
    reload();
  };

  const filtered = users.filter((u) => {
    const matchesSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "All" || u.level === levelFilter;
    const matchesRole = roleFilter === "All" || (roles[u.id] || ["student"]).includes(roleFilter);
    return matchesSearch && matchesLevel && matchesRole;
  });

  const roleLabel = (uid: string) => {
    const rs = roles[uid] || [];
    if (rs.includes("admin")) return <span className="badge-purple">ADMIN</span>;
    if (rs.includes("rep")) return <span className="badge-blue">REP</span>;
    return <span className="text-muted-foreground">student</span>;
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Users" subtitle={`${users.length} registered students`} />

      <div className="grid grid-cols-3 gap-2">
        <input className={inputClass} placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      <TableShell>
        <thead><tr>
          <Th>Name</Th><Th>Email</Th><Th>Level</Th><Th>Dept</Th><Th>Matric</Th><Th>XP</Th><Th>🔥</Th><Th>Role</Th><Th>Joined</Th><Th>Actions</Th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRow cols={10} text="No users match." /> : filtered.map((u) => (
            <tr key={u.id} className={u.is_banned ? "opacity-50" : ""}>
              <Td className="font-medium">{u.full_name || "—"}</Td>
              <Td className="max-w-[140px] truncate">{u.email}</Td>
              <Td>{u.level || "—"}</Td>
              <Td className="max-w-[100px] truncate">{u.department || "—"}</Td>
              <Td>{u.matric_no || "—"}</Td>
              <Td>{u.xp}</Td>
              <Td>{u.streak}</Td>
              <Td>{roleLabel(u.id)}</Td>
              <Td className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</Td>
              <Td>
                <div className="flex gap-1">
                  <ActionBtn onClick={() => setViewing(u)}><Eye className="h-3 w-3" /></ActionBtn>
                  <ActionBtn tone="primary" onClick={() => promote(u)}><Shield className="h-3 w-3" /></ActionBtn>
                  <ActionBtn
                    tone={(roles[u.id] || []).includes("admin") ? "danger" : "primary"}
                    onClick={() => toggleAdmin(u)}
                   
                  ><Crown className="h-3 w-3" /></ActionBtn>
                  {!isHardcodedAdminEmail(u.email) && (
                    <ActionBtn tone={u.is_banned ? "success" : "danger"} onClick={() => toggleBan(u)}>
                      <Ban className="h-3 w-3" /> {u.is_banned ? "Unban" : "Ban"}
                    </ActionBtn>
                  )}
                  <ActionBtn tone="danger" onClick={() => remove(u)}><Trash2 className="h-3 w-3" /></ActionBtn>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="surface-card p-5 w-full max-w-md space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold">{viewing.full_name || "Unnamed student"}</p>
            <p className="text-xs text-muted-foreground">{viewing.email}</p>
            <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
              <div><span className="text-muted-foreground">Level:</span> {viewing.level || "—"}</div>
              <div><span className="text-muted-foreground">Dept:</span> {viewing.department || "—"}</div>
              <div><span className="text-muted-foreground">Matric:</span> {viewing.matric_no || "—"}</div>
              <div><span className="text-muted-foreground">Role:</span> {(roles[viewing.id] || ["student"]).join(", ")}</div>
              <div><span className="text-muted-foreground">XP:</span> {viewing.xp}</div>
              <div><span className="text-muted-foreground">Streak:</span> {viewing.streak} 🔥</div>
              <div className="col-span-2"><span className="text-muted-foreground">Joined:</span> {new Date(viewing.created_at).toLocaleString()}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Status:</span> {viewing.is_banned ? "🚫 Banned" : "✅ Active"}</div>
            </div>
            <button onClick={() => setViewing(null)} className="w-full mt-3 surface-card py-2 text-xs">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
