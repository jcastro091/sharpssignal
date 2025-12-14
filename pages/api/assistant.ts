// pages/api/assistant.ts
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

// ⬅️ use your existing bet-log helpers
import { findHistoricalPick } from "./picks";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

// ---------- Types that match your frontend ----------

type FaqMsg = { type: "faq"; answer: string };

type PickMsg = {
  type: "pick";
  matchup: { home: string; away: string; league?: string; startTimeISO?: string };
  recommendation: string;
  reason: string;
  evPct?: number;
  suggestedStakePct?: number;
  proFeature?: boolean;
};

type ErrorMsg = { type: "error"; message: string };

type AssistantMsg = FaqMsg | PickMsg | ErrorMsg;

// ---------- Helpers ----------

// Same intent logic as in assistant.tsx
function guessIntent(q: string): "quote" | "summary" | "pick" | "faq" | "chat" {
  const s = q.toLowerCase();

  const hasPickWord = s.includes("pick");
  const hasDateWord = /yesterday|today|last night|last game|for tonight|tonight/.test(s);

  if (/best odds|moneyline|ml\b|spread|total|h2h|line shop|price shop/.test(s)) {
    return "quote";
  }

  if (/matchup|summary|who (wins|is likely to win)|line.?movement|injur(y|ies)|weather/.test(s)) {
    return "summary";
  }

  if (/explain.*pick|why.*pick|reason.*pick/.test(s) || (hasPickWord && hasDateWord)) {
    return "pick";
  }

  if (/who are you|how.*work|sign ?up|pricing|terms|privacy|faq/.test(s)) {
    return "faq";
  }

  return "chat";
}



// helper: convert Node stream to string
async function streamToString(stream: any): Promise<string> {
  if (typeof stream === "string") return stream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// VERY simple S3 context fetcher: grab the most recent object under a prefix
async function getContextFromS3(): Promise<string> {
  const bucket = process.env.SS_DATA_BUCKET;
  const prefix = process.env.SS_DATA_PREFIX || "";

  if (!bucket) return "";

  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 50,
    })
  );

  const contents = list.Contents || [];
  if (!contents.length) return "";

  // sort newest first
  contents.sort((a, b) => {
    const at = a.LastModified?.getTime() || 0;
    const bt = b.LastModified?.getTime() || 0;
    return bt - at;
  });

  const key = contents[0].Key;
  if (!key) return "";

  const obj = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const body = await streamToString(obj.Body as any);

  // Don’t send megabytes of CSV to the LLM – truncate
  return body.slice(0, 50_000); // first ~50k chars
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssistantMsg>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ type: "error", message: "Method not allowed" });
  }

  try {
    const { q } = req.body || {};
    const question = (q || "").toString().trim();

    if (!question) {
      return res
        .status(400)
        .json({ type: "error", message: "Missing question (q) in body." });
    }

    const intent = guessIntent(question);

    // 1) Odds + matchup summaries are handled by existing endpoints
    //    => return an error so the frontend fallback calls /api/odds-shop or /api/matchup-chat
    if (intent === "quote" || intent === "summary") {
      return res.status(400).json({
        type: "error",
        message: "Use odds or matchup endpoints for this question.",
      });
    }

    // 2) Pick / bet-log questions => use your AllBets log via picks.ts
	if (intent === "pick") {
	  try {
		const hist = await findHistoricalPick({
		  dateHint: question, // or whatever you’re currently passing
		  nocache: false,
		});

		if (!hist) {
		  return res.status(200).json({
			type: "faq",
			answer:
			  "I couldn’t find a logged pick for that time window in your bet log.",
		  });
		}

		const [awayRaw, homeRaw] = (hist.matchup || "").split("@");
		const away = (awayRaw || (hist as any).away || "").trim();
		const home = (homeRaw || (hist as any).home || "").trim();

		const recommendationParts: string[] = [];
		if ((hist as any).pick) recommendationParts.push(String((hist as any).pick));
		if ((hist as any).line != null && (hist as any).line !== "") {
		  recommendationParts.push(String((hist as any).line));
		}
		if ((hist as any).american_odds != null && (hist as any).american_odds !== "") {
		  recommendationParts.push(`@ ${(hist as any).american_odds}`);
		}

		return res.status(200).json({
		  type: "pick",
		  matchup: {
			home,
			away,
			league: (hist as any).sport || undefined,
			startTimeISO: (hist as any).startTimeISO || undefined,
		  },
		  recommendation:
			recommendationParts.join(" ").trim() || "Pick details not fully logged.",
		  reason:
			(hist as any).reason ||
			(hist as any).movement ||
			"No explanation was logged for this pick in your bet log.",
		  evPct:
			(hist as any).ev_percent != null && (hist as any).ev_percent !== ""
			  ? Number((hist as any).ev_percent)
			  : undefined,
		  suggestedStakePct:
			(hist as any).kelly_pct != null && (hist as any).kelly_pct !== ""
			  ? Number((hist as any).kelly_pct)
			  : undefined,
		  proFeature: !!(hist as any).pro,
		});
	  } catch (err) {
		console.error("[assistant] pick error:", err);
		return res.status(200).json({
		  type: "faq",
		  answer:
			"I tried to read your bet log, but the backend auth failed. " +
			"Check your Google service account key or migrate the bet log to S3.",
		});
	  }
	}
	
	function faqAnswer(q: string): string | null {
	  const s = q.toLowerCase();
	  if (s.includes("sign up")) return "You can sign up at sharps-signal.com/subscribe (Free & Pro tiers).";
	  if (s.includes("pricing")) return "See sharps-signal.com/subscribe for current Pro pricing.";
	  if (s.includes("who are you") || s.includes("what is sharpssignal"))
		return "SharpsSignal uses live odds and limits + AI to surface value bets with transparent logs. Bet responsibly.";
	  return null;
	}

	// 3) FAQ shortcut
	const localFaq = faqAnswer(question);
	if (localFaq) {
	  return res.status(200).json({ type: "faq", answer: localFaq });
	}


    // 4) Everything else => generic sports / SharpsSignal questions via OpenAI
    let s3Context = "";
    try {
      s3Context = await getContextFromS3();
    } catch (e) {
      console.error("[assistant] S3 context error:", e);
      // still proceed, just with no context
    }

	const response = await openai.responses.create({
	  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
	  instructions:
		"You are the SharpsSignal sports assistant. " +
		"Use the provided S3 data context if it looks relevant. " +
		"Answer clearly and DO NOT give specific betting advice; just explain, summarize, or clarify.",
	  input: [
		{
		  role: "user",
		  content: [
			{
			  type: "input_text",
			  text:
				"User question:\n" +
				question +
				"\n\n" +
				"Relevant data context (may be truncated):\n" +
				(s3Context || "[no S3 context loaded]"),
			},
		  ],
		},
	  ],
	});



    const answer = response.output_text || "I generated an empty answer.";

    return res.status(200).json({
      type: "faq",
      answer,
    });
  } catch (err: any) {
    console.error("[assistant] error:", err);
    return res.status(500).json({
      type: "error",
      message: "Assistant failed. Check server logs.",
    });
  }
}
