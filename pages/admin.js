import Link from "next/link";
import { requireCeoPageAccess } from "../lib/ceoAccess";
export async function getServerSideProps({ req, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  const access = await requireCeoPageAccess(req, res);
  if (!access.allowed)
    return {
      redirect: {
        destination: access.redirect || "/dashboard",
        permanent: false,
      },
    };
  return { props: {} };
}
export default function Admin() {
  return (
    <main className="brand-page">
      <span className="eyebrow">PRIVATE · ADMINISTRATION</span>
      <h1>Your operating room.</h1>
      <p>
        Business, operations and delivery controls stay separate from the member
        experience.
      </p>
      <div className="feature-grid">
        <Link className="feature-card" href="/analytics">
          <h2>Website analytics →</h2>
          <p>Readership, engagement, heatmaps and the conversion funnel.</p>
        </Link>
        <a
          className="feature-card"
          href="/api/admin-launch"
        >
          <h2>Operations & business ↗</h2>
          <p>
            Open the private command center with your verified administrator
            sign-in.
          </p>
        </a>
        <a
          className="feature-card"
          href="/api/admin-launch?target=audience"
        >
          <h2>Audience & registrations ↗</h2>
          <p>Manage the signup proof of concept in the private workspace.</p>
        </a>
      </div>
      <Link className="button-secondary" href="/dashboard">
        Back to member view
      </Link>
    </main>
  );
}
