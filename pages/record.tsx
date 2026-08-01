export default function PrivateVerificationRedirect() { return null; }

export function getServerSideProps() {
  return { redirect: { destination: "/verification", permanent: false } };
}
