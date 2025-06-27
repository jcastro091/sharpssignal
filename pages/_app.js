// pages/_app.js
import "../styles/globals.css";
import Script from "next/script";

export default function MyApp({ Component, pageProps }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <>
      {/* Tailwind CDN (optional if using compiled CSS) */}
      <Script
        src="https://cdn.tailwindcss.com"
        strategy="beforeInteractive"
      />

      {/* Global GA4 snippet */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                page_path: window.location.pathname
              });
            `}
          </Script>
        </>
      )}

      <Component {...pageProps} />
    </>
  );
}
