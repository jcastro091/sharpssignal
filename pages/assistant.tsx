export default function PrivateAssistantRedirect() { return null; }

export function getServerSideProps() {
  return { redirect: { destination: "/subscribe", permanent: false } };
}
