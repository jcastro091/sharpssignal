export async function getServerSideProps() {
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
