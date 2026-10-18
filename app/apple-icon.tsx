import { ImageResponse } from "next/og";
import { PATH_API, TRANSFORM_API } from "@/lib/situs";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8531f" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d={PATH_API} fill="#fff" transform={TRANSFORM_API} />
        </svg>
      </div>
    ),
    size,
  );
}
