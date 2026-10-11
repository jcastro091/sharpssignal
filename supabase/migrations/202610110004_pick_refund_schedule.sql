-- Reuse the existing worker and its scoped HMAC credential. The service-role
-- key itself is never stored in Vault or in the cron command.
CREATE TABLE IF NOT EXISTS public.pick_refund_dispatches (
  request_id bigint PRIMARY KEY,
  dispatched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pick_refund_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pick_refund_dispatches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pick_refund_dispatches TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_pick_refund_worker()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE worker_token text; request_id bigint;
BEGIN
  SELECT decrypted_secret INTO worker_token FROM vault.decrypted_secrets
  WHERE name = 'sharpssignal_pick_refund_worker';
  IF worker_token IS NULL THEN RAISE EXCEPTION 'Refund worker credential is missing'; END IF;
  SELECT net.http_post(
    url := 'https://www.sharps-signal.com/api/admin/pick-refund-worker',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_token),
    body := '{"mode":"live"}'::jsonb, timeout_milliseconds := 60000
  ) INTO request_id;
  INSERT INTO public.pick_refund_dispatches(request_id) VALUES(request_id);
  DELETE FROM public.pick_refund_dispatches WHERE dispatched_at < now() - interval '7 days';
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.invoke_pick_refund_worker() FROM PUBLIC, anon, authenticated, service_role;

-- Administrative provisioning via HTTPS RPC keeps the credential out of
-- SQL editor history and source. No application role can call this function.
CREATE OR REPLACE FUNCTION public.configure_pick_refund_schedule(worker_token text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid; job_id bigint;
BEGIN
  IF worker_token IS NULL OR worker_token !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid scoped worker token';
  END IF;
  SELECT id INTO secret_id FROM vault.secrets WHERE name = 'sharpssignal_pick_refund_worker';
  IF secret_id IS NULL THEN
    PERFORM vault.create_secret(worker_token, 'sharpssignal_pick_refund_worker', 'Scoped pick refund worker HMAC; rotate when service key changes');
  ELSE
    PERFORM vault.update_secret(secret_id, worker_token);
  END IF;
  SELECT cron.schedule('sharpssignal-pick-refunds', '*/5 * * * *', 'select public.invoke_pick_refund_worker();') INTO job_id;
  RETURN job_id;
END;
$$;
REVOKE ALL ON FUNCTION public.configure_pick_refund_schedule(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_pick_refund_schedule(text) TO service_role;
