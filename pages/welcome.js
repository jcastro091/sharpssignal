// /pages/welcome.js
import { useEffect } from "react";

export default function WelcomePage() {
  useEffect(() => {
    console.log("WelcomePage loaded");
    console.log("window.location.href:", window.location.href);
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Welcome to SharpSignal 🎉</h1>
      <p>Your email has been verified successfully.</p>
    </div>
  );
}
