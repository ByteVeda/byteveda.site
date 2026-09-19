import { type NextRequest, NextResponse } from "next/server";

import { validateOrder } from "@/lib/orders/model";
import { submitOrder } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a json body" }, { status: 400 });
  }

  const order = validateOrder(payload);
  if (!order.ok) {
    return NextResponse.json({ error: order.reason }, { status: 400 });
  }

  const result = await submitOrder(order);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }

  // No price in the response: the sample is free and the page shows no money.
  // The figure stays server-side, in the work order the team gets.
  return NextResponse.json({ reference: result.reference });
}
