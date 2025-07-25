// pages/auth/signin.js
import { getCsrfToken } from "next-auth/react"

export default function SignIn({ csrfToken, error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-600">
      <form
        method="post"
        action="/api/auth/callback/credentials"
        className="p-8 bg-white rounded shadow"
      >
        <input name="csrfToken" type="hidden" defaultValue={csrfToken} />
        {error && (
          <p className="mb-4 text-red-600">
            {error === "CredentialsSignin"
              ? "Invalid email or password"
              : error}
          </p>
        )}
        <label className="block mb-4">
          Email
          <input
            name="email"
            type="email"
            required
            className="w-full border p-2"
          />
        </label>
        <label className="block mb-4">
          Password
          <input
            name="password"
            type="password"
            required
            className="w-full border p-2"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Sign In
        </button>
        <p className="mt-4 text-center">
          Don’t have an account?{" "}
          <a href="/auth/signup" className="underline text-blue-600">
            Sign up
          </a>
        </p>
      </form>
    </div>
  )
}

export async function getServerSideProps(ctx) {
  return {
    props: {
      csrfToken: await getCsrfToken(ctx),
      error: ctx.query.error ?? null,
    },
  }
}
