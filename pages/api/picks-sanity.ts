import type { NextApiRequest, NextApiResponse } from "next";
import { getPickForQuery } from "./picks";

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  try {
    const sample = await getPickForQuery("today");
    res.status(200).json({ ok: true, samplePresent: !!sample, sample });
  } catch (e:any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
