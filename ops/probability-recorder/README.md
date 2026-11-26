# Private actual-bet probability recorder

The owner requested minute-by-minute probability history on November 26, 2026.
This observer reads the existing redacted actual-fill dashboard from S3 and
uses the same exact-game live-score/forecast code as My Plays. It never reads
venue credentials, submits orders, changes sizing/limits, grades a bet, or
changes a research cohort/model. No paper return becomes actual performance.

`sharpssignal-probability-timeline` runs on AWS Lambda Node22 every minute via
EventBridge, concurrency one and asynchronous retries disabled. It reuses the
existing role/log group without IAM changes. AWS SDK v3.948.0 and its dependency
integrities are pinned in the adjacent lock file. Deploy using
`python scripts/deploy-probability-recorder.py` after installing the pinned
dependencies with scripts disabled. No local computer/browser is needed.

Private S3 prefix:
`ops/movement_evidence/prediction-execution/live-pilot/v1/probability-timeline/v1/`.
Only genuine filled, unsettled positions are eligible, from 15 minutes before
scheduled start through the existing 36-hour live-score window. Each actual
order is separate across venues; overlapping strategy attribution does not
create another order or financial result. At most 40 positions are evaluated
per invocation. No prior percentage is reconstructed or moved to an earlier
timestamp. Initial collection began about **11:52 AM Eastern on November 26**.

Samples retain actual capture time, provider/model probability timestamp,
source, model version/experimental label, exact selection, score/status and
software release. Original library freshness/identity checks remain intact;
the recorder separately rejects stale/future/malformed probability data.
Pregame, completed and unavailable/stale estimates are explicit gaps, not
zero/100% predictions. ESPN and local experimental estimates are distinct.
This is not a full play-by-play archive or evidence of calibration/edge.

History append uses S3 conditional writes and a per-order/minute identity.
Duplicate calls cannot append a second point in the same minute. Points are
not silently discarded; the 2160-point capacity refuses additional appends and
reports attention. Prior samples survive restarts and remain available after
settlement. The known index is preseeded because the existing role deliberately
cannot enumerate the bucket. Collection failure/heartbeat staleness is visible
on the card. Existing execution alerts/risk controls are independent.

The owner-authenticated history API validates a 64-character record hash and
uses the existing private evidence reader. Anonymous/other member requests
cannot read the history. S3 locations, account/exchange IDs, keys and signed
requests are not returned. The UI chart and accessible sample table distinguish
sources, display recorded times in Eastern, and preserve visible gaps.

Current win/cover percentages are refreshed separately on the collapsed cards.
The automated-fill merge previously bypassed score enrichment; the fix adds
only live metadata and cannot overwrite fee, stake, settlement or attribution.
Game start is separately labelled from the bet's tracked timestamp, including
Eastern date and daylight-saving designation.
