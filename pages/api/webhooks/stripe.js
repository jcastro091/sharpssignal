// pages/api/webhooks/stripe.js
import { buffer } from 'micro'
import Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')

  const sig = req.headers['stripe-signature']
  const buf = await buffer(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    // session.customer_email, session.metadata.plan, etc.
    // TODO: call your onboarding routine (Telegram, DB, email...)
    console.log('✅ New subscription:', session.customer_email)
  }

  res.status(200).json({ received: true })
}
