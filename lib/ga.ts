type GAEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
};

export function gaEvent({ action, category, label, value }: GAEvent) {
  // @ts-ignore
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  // @ts-ignore
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
}
