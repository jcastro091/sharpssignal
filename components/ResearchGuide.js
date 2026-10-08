import { trackMemberEvent } from "../lib/memberAnalytics";
export default function ResearchGuide({ section = "sports", open = false }) {
  return (
    <details
      className="research-guide"
      open={open || undefined}
      onToggle={(e) => {
        if (e.currentTarget.open)
          trackMemberEvent("member_guide_open", { section });
      }}
    >
      <summary>
        How to read a{" "}
        {section === "sports" ? "sports record" : "Markets record"}
      </summary>
      {section === "sports" ? (
        <ol>
          <li>
            <b>Captured price.</b> Decimal odds when the paper entry was
            recorded, not a price you can necessarily get now. At 2.00, a
            winning 1-unit paper stake returns 2 units including the stake.
          </li>
          <li>
            <b>Paper result.</b> Win, loss, or push after grading. Pending means
            the outcome is not settled yet; unavailable means we do not have a
            usable result. No money is placed.
          </li>
          <li>
            <b>Closing-price evidence.</b> CLV compares the captured price with
            the closing reference. Positive CLV means a better captured price
            under the research method; it does not mean the selection won. A
            missing comparison is not zero.
          </li>
        </ol>
      ) : (
        <p>
          Entry is the recorded paper price. Stop and target are research risk
          levels. Open trades have pending results; a closed trade without a
          recorded P&amp;L has unavailable data. These are experimental paper
          trades, not live orders.
        </p>
      )}
      <p>
        Only records released for members appear here. A small paper sample does
        not establish a profitable edge.
      </p>
    </details>
  );
}
