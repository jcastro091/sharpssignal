export function feedState(feed, error = "") {
  if (error)
    return {
      kind: "unavailable",
      title: "Data unavailable",
      detail:
        "We could not load your member records. Try Refresh. This does not mean no signals qualified.",
    };
  if (!feed)
    return {
      kind: "loading",
      title: "Loading",
      detail: "Checking available member records…",
    };
  if (
    !Array.isArray(feed.plays) ||
    !["available", "stale", "no_qualifying_signals"].includes(feed.status)
  )
    return feedState(null, "unavailable");
  if (feed.publishing_paused)
    return {
      kind: "paused",
      title: "Publishing paused",
      detail:
        "Member publishing is paused. This does not establish whether signals qualified.",
    };
  if (feed.status === "stale")
    return {
      kind: "stale",
      title: "Update delayed",
      detail:
        "These are previously available records. Current availability is not confirmed.",
    };
  if (!feed.plays.length)
    return feed.status === "no_qualifying_signals"
      ? {
          kind: "empty",
          title: "No qualifying signals",
          detail:
            "The feed reports no qualifying signals for this view. Check back later or read the example.",
        }
      : {
          kind: "empty",
          title: "No published records yet",
          detail:
            "No records are available to members in this view. This does not mean no signals qualified. Read the example while collection and publication continue.",
        };
  return {
    kind: "available",
    title: "Records available",
    detail:
      "Only records released for members are shown. Past entries are not current opportunities.",
  };
}
export function resultLabel(record, section = "sports") {
  const value = String(
    section === "sports"
      ? record.result || record.settlement_status || ""
      : record.status || "",
  ).toLowerCase();
  if (["win", "won", "w"].includes(value)) return "Win";
  if (["loss", "lost", "l"].includes(value)) return "Loss";
  if (["push", "void"].includes(value))
    return value === "push" ? "Push" : "Void";
  if (["pending", "open", "unsettled", "scheduled"].includes(value))
    return "Pending";
  if (section === "markets" && value === "closed") return "Closed";
  return "Unavailable";
}
export function firstRecordIndex(plays, section) {
  const settled = plays.findIndex((p) =>
    ["Win", "Loss", "Push", "Void", "Closed"].includes(resultLabel(p, section)),
  );
  return settled < 0 ? 0 : settled;
}
