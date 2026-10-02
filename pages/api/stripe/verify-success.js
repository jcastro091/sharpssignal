import Stripe from "stripe";
import { getServerUser } from "../../../lib/authServer";
import { createCheckoutVerifier } from "../../../lib/checkoutVerification";

export default createCheckoutVerifier({
  getUser: getServerUser,
  getStripe: () =>
    process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY, {
          timeout: 10000,
          maxNetworkRetries: 0,
        })
      : null,
});
