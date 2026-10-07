import Script from "next/script";

const GA_ID =
  process.env.NEXT_PUBLIC_GA4_ID ||
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  "G-1YRZ2NHRZ0";

export default function GA() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          if (!window.__ssGaConfigured) {
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { send_page_view: false, debug_mode: false, page_location: location.origin + location.pathname, page_referrer: '' });
            window.__ssGaConfigured = true;
          }
        `}
      </Script>
    </>
  );
}
