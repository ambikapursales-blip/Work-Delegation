export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  LOGISTICS: "Logistics",
  ACCOUNTS: "Accounts",
  SALES: "Sales",
  SERVICE: "Service",
  PARTS: "Parts",
  HR: "HR",
  MARKETING: "Marketing",
  BACK_OFFICE: "Back Office",
};

export const ALL_ROLES = Object.values(ROLES);

export const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MANAGER]: 60,
  [ROLES.HR]: 60,
  [ROLES.LOGISTICS]: 40,
  [ROLES.ACCOUNTS]: 40,
  [ROLES.SALES]: 40,
  [ROLES.SERVICE]: 40,
  [ROLES.PARTS]: 40,
  [ROLES.MARKETING]: 40,
  [ROLES.BACK_OFFICE]: 40,
};

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export const HIGH_PRIVILEGE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR];
