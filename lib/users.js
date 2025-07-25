import fs from "fs"
import path from "path"
import { compare, hash } from "bcryptjs"

const DATA_FILE = path.join(process.cwd(), "data", "users.json")

// ensure the data folder + file exist
function ensureFile() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]")
}

export async function verifyUser(email, plainTextPassword) {
  const users = getUsers()
  console.log("🔍 Users on disk:", users)
  const user = users.find((u) => u.email === email)
  console.log("👤 Lookup:", user)
  if (!user) return null
  const ok = await compare(plainTextPassword, user.passwordHash)
  console.log("🔑 Password match:", ok)
  return ok ? { id: email, email } : null
}



export function getUsers() {
  ensureFile()
  const raw = fs.readFileSync(DATA_FILE, "utf8")
  return JSON.parse(raw)
}

export async function addUser(email, plainTextPassword) {
  ensureFile()
  const users = getUsers()
  if (users.find((u) => u.email === email)) {
    throw new Error("User already exists")
  }
  const passwordHash = await hash(plainTextPassword, 12)
  users.push({ email, passwordHash })
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2))
  console.log("💾 Wrote users.json:", users)
}


