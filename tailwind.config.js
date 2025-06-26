/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./styles/globals.css",      // ← make sure this is here
  ],
  theme: { extend: {} },
  plugins: [],
}

