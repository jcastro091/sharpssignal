// components/ClientOnlyDate.js
import { useState, useEffect } from "react";

export default function ClientOnlyDate({ value }) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (!isNaN(d)) setFormatted(d.toLocaleString());
  }, [value]);

  return <>{formatted || value}</>;
}
