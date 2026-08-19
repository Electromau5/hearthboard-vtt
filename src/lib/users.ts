import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const ACCOUNTS = [
  {
    id: "gamelord",
    username: "gamelord",
    passwordHash: "$2b$12$BGbkQ4SuB3zwXqgoP46oYuq3RWKeDaGKKDX9/mbJrjfLRW9B9RSVu",
    defaultRole: "admin" as const,
    protected: true,
  },
  {
    id: "shay",
    username: "shay",
    passwordHash: "$2b$12$BOyGDQFfeJwwjAomCqB4qee7t4oroKWE5lTc8mSwSmdnVknvuuiFW",
    defaultRole: "user" as const,
    protected: false,
  },
  {
    id: "greg",
    username: "greg",
    passwordHash: "$2b$12$FDUEkDNz5BsoARsFIOXOzu24PXk0VeizKMZN4CQkwWwjEM/8z97Ye",
    defaultRole: "user" as const,
    protected: false,
  },
  {
    id: "sanch",
    username: "sanch",
    passwordHash: "$2b$12$fPHVaC91VWNxWdWhHJA6ru3wAMYNgK.fV1DUVg1pUrghkAMSjtzkG",
    defaultRole: "user" as const,
    protected: false,
  },
] as const;

const DATA_DIR = path.join(process.cwd(), "data");
const ROLES_FILE = path.join(DATA_DIR, "roles.json");

function getRoleOverrides(): Record<string, "admin" | "user"> {
  try {
    if (!fs.existsSync(ROLES_FILE)) return {};
    return JSON.parse(fs.readFileSync(ROLES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveRoleOverrides(overrides: Record<string, "admin" | "user">): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ROLES_FILE, JSON.stringify(overrides, null, 2));
}

export type PublicUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  protected: boolean;
};

export function getAllUsers(): PublicUser[] {
  const overrides = getRoleOverrides();
  return ACCOUNTS.map((a) => ({
    id: a.id,
    username: a.username,
    role: overrides[a.id] ?? a.defaultRole,
    protected: a.protected,
  }));
}

export function getUserById(id: string): PublicUser | undefined {
  return getAllUsers().find((u) => u.id === id);
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: string; name: string; username: string; role: "admin" | "user" } | null> {
  const account = ACCOUNTS.find(
    (a) => a.username === username.toLowerCase().trim()
  );
  if (!account) return null;
  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) return null;
  const overrides = getRoleOverrides();
  const role = overrides[account.id] ?? account.defaultRole;
  return { id: account.id, name: account.username, username: account.username, role };
}

export function setRole(id: string, role: "admin" | "user"): void {
  const account = ACCOUNTS.find((a) => a.id === id);
  if (!account || account.protected) return;
  const overrides = getRoleOverrides();
  if (role === account.defaultRole) {
    delete overrides[id];
  } else {
    overrides[id] = role;
  }
  saveRoleOverrides(overrides);
}
