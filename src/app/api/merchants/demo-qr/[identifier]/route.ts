import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { ApiError } from "@/lib/errors/api-error";
import { resolveRequestId } from "@/lib/request-id";
import { getMerchantByDemoQrIdentifier } from "@/lib/merchants/merchant-service";
import { isDemoQrIdentifier } from "@/lib/qr/demo-qr";

type RouteProps = {
  params: Promise<{ identifier: string }>;
};

export async function GET(request: Request, props: RouteProps) {
  const requestId = resolveRequestId(request);

  try {
    const { identifier } = await props.params;
    if (!isDemoQrIdentifier(identifier)) {
      throw ApiError.validationError(
        [{ field: "identifier", issue: "Unsupported GlobalPay demo QR identifier." }],
        "Invalid demo QR identifier."
      );
    }

    const merchant = await getMerchantByDemoQrIdentifier(identifier);
    return NextResponse.json(
      { merchant },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}
