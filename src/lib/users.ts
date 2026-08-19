import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "user";
  createdAt: string;
}

function read(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function write(users: User[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Seeds the initial admin account on first run.
export async function ensureAdminExists(): Promise<void> {
  const users = read();
  const adminEmail = "pritishsaik89@gmail.com";
  if (!users.find((u) => u.email === adminEmail)) {
    const passwordHash = await bcrypt.hash("lovecraft1930", 12);
    users.push({
      id: crypto.randomUUID(),
      email: adminEmail,
      name: "Pritish",
      passwordHash,
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    write(users);
  }
}

export function getUserByEmail(email: string): User | undefined {
  return read().find((u) => u.email === email.toLowerCase().trim());
}

export function getUserById(id: string): User | undefined {
  return read().find((u) => u.id === id);
}

export function getAllUsers(): Omit<User, "passwordHash">[] {
  return read().map(({ passwordHash: _, ...u }) => u);
}

export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<Omit<User, "passwordHash">> {
  const users = read();
  const normalised = email.toLowerCase().trim();
  if (users.find((u) => u.email === normalised)) {
    throw new Error("Email already registered.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = {
    id: crypto.randomUUID(),
    email: normalised,
    name: name.trim(),
    passwordHash,
    role: "user",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  write(users);
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export function setRole(id: string, role: "admin" | "user"): void {
  const users = read();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error("User not found.");
  user.role = role;
  write(users);
}

export function deleteUser(id: string): void {
  const users = read();
  write(users.filter((u) => u.id !== id));
}
