// pages/legal.js
export default function LegalPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4 text-center">SharpSignal Legal</h1>
      <p className="text-center mb-8 text-sm text-gray-500">
        Last updated: July 22, 2025
      </p>

      {/* Terms of Service */}
      <h2 className="text-2xl font-bold mt-10 mb-4" id="terms">📜 Terms of Service</h2>
      <p className="mb-4">By accessing or using SharpSignal, you agree to the following terms:</p>

      <ul className="list-disc list-inside space-y-3">
        <li><strong>Service:</strong> SharpSignal provides AI-generated betting and trading alerts via Telegram and a web dashboard. We do not execute trades or place bets on your behalf.</li>
        <li><strong>No Guarantees:</strong> All signals are for informational purposes only. Past performance is not indicative of future results. Use at your own risk.</li>
        <li><strong>User Responsibility:</strong> You are solely responsible for how you use the information provided. SharpSignal is not liable for any financial decisions made by users.</li>
        <li><strong>Prohibited Use:</strong> You may not redistribute, resell, or automate our alerts without written permission. We reserve the right to suspend access for abuse or misuse.</li>
        <li><strong>Billing & Cancellations:</strong> Subscriptions are billed monthly or annually. You may cancel anytime; prorated refunds apply unless stated otherwise.</li>
        <li><strong>Modifications:</strong> We may update this policy at any time. Continued use of SharpSignal constitutes acceptance of the changes.</li>
      </ul>

      {/* Privacy Policy */}
      <h2 className="text-2xl font-bold mt-10 mb-4" id="privacy">🔐 Privacy Policy</h2>
      <p className="mb-4">Your privacy matters. Here's what we collect and how it's used:</p>

      <ul className="list-disc list-inside space-y-3">
        <li><strong>What We Collect:</strong> Email address, login metadata, Telegram handle, and interaction data with our dashboard and alerts.</li>
        <li><strong>How It’s Used:</strong> To deliver alerts, manage subscriptions, improve signal accuracy, and provide support. Occasionally, we may send service updates.</li>
        <li><strong>Third-Party Tools:</strong> We use Stripe for payments, Supabase for authentication, Telegram for alerts, and Google Analytics for performance tracking.</li>
        <li><strong>Data Security:</strong> Your data is stored securely using industry best practices. We do not sell or share your personal data with third parties.</li>
        <li><strong>Your Rights:</strong> You may request deletion of your data by contacting support. We will process such requests within 7 days.</li>
        <li><strong>Cookies:</strong> We use cookies for analytics and login tracking. By using SharpSignal, you consent to cookie usage as described.</li>
      </ul>

      <p className="mt-6 text-sm text-gray-500">
        If you have any questions, contact us at <a href="mailto:sharpsignal@gmail.com" className="underline">sharpsignal@gmail.com</a>.
      </p>
    </div>
  );
}
