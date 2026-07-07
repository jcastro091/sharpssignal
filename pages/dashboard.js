import { requireServerUser } from "../lib/authServer";

export async function getServerSideProps({ req, res }) {
  const auth = await requireServerUser(req, res);
  if (!auth.user) {
    return {
      redirect: {
        destination: auth.redirect || "/signin?next=%2Fdashboard",
        permanent: false,
      },
    };
  }
  return {
    redirect: {
      destination: "/picks",
      permanent: false,
    },
  };
}

export default function DashboardRedirect() {
  return null;
}
