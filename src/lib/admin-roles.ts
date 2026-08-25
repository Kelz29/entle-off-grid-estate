/** Admin portal roles and section permissions. */

export type AdminRole = "owner" | "manager" | "staff";

export type AdminSection =
  | "overview"
  | "bookings"
  | "payments"
  | "clients"
  | "seats"
  | "users";

export const ADMIN_ROLES: {
  id: AdminRole;
  label: string;
  hint: string;
}[] = [
  {
    id: "owner",
    label: "Owner",
    hint: "Full access including staff accounts",
  },
  {
    id: "manager",
    label: "Manager",
    hint: "Bookings, payments, clients, and seats",
  },
  {
    id: "staff",
    label: "Staff",
    hint: "Day of service: overview and bookings only",
  },
];

const SECTION_ACCESS: Record<AdminRole, readonly AdminSection[]> = {
  owner: ["overview", "bookings", "payments", "clients", "seats", "users"],
  manager: ["overview", "bookings", "payments", "clients", "seats"],
  staff: ["overview", "bookings"],
};

export function sectionsForRole(role: AdminRole): readonly AdminSection[] {
  return SECTION_ACCESS[role] ?? SECTION_ACCESS.staff;
}

export function canAccessSection(role: AdminRole, section: AdminSection): boolean {
  return sectionsForRole(role).includes(section);
}

export function canManageUsers(role: AdminRole): boolean {
  return role === "owner";
}

export function canBroadcast(role: AdminRole): boolean {
  return role === "owner" || role === "manager";
}

export function canManageSeats(role: AdminRole): boolean {
  return role === "owner" || role === "manager";
}

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "owner" || value === "manager" || value === "staff";
}

export function defaultSectionForRole(role: AdminRole): AdminSection {
  return sectionsForRole(role)[0] ?? "overview";
}
