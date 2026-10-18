export default function PickShopLoadState({loading, error, onRetry}) {
  if (loading) return <p className="shop-small" role="status">Loading recent plays…</p>;
  if (error) return <div className="refund-notice" role="alert"><p>Recent plays could not be loaded. Your purchases have not changed.</p><button className="button-secondary" onClick={onRetry}>Try again</button></div>;
  return null;
}
