// pages/api/auth/signup.js
import { addUser } from "../../../lib/users"

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" })

  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" })

  try {
    await addUser(email, password)
    return res.status(201).json({ message: "User created" })
  } catch (err) {
    console.error("Signup error:", err)
    return res.status(400).json({ error: err.message })
  }
}
