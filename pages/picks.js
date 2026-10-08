import { checkoutDestination } from "../lib/authRedirect";
export function getServerSideProps({ query }) {
  return {
    redirect: { destination: checkoutDestination(query), permanent: false },
  };
}
export default function Picks() {
  return null;
}
