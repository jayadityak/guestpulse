import { NextRequest, NextResponse } from "next/server";
import { getJobStatus, getCityHotels } from "@/lib/backend";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const job = await getJobStatus(jobId);
    // If done, attach the hotels so the frontend only needs one request
    if (job.status === "done") {
      const hotels = await getCityHotels(job.city).catch(() => []);
      return NextResponse.json({ ...job, hotels });
    }
    return NextResponse.json(job);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
