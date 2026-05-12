import { ImageResponse } from "next/og";

export const alt = "Quorum | QR Attendance and Grading for Teachers";
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    position: "relative",
                    overflow: "hidden",
                    background:
                        "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 45%, #dbeafe 100%)",
                    color: "#0f172a",
                    fontFamily: "sans-serif",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "radial-gradient(circle at top left, rgba(59, 130, 246, 0.24), transparent 32%), radial-gradient(circle at 85% 18%, rgba(14, 165, 233, 0.18), transparent 24%)",
                    }}
                />
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "56px 64px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 18,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#0f172a",
                                color: "#ffffff",
                                fontSize: 30,
                                fontWeight: 700,
                            }}
                        >
                            Q
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 40,
                                    fontWeight: 700,
                                }}
                            >
                                Quorum
                            </div>
                            <div
                                style={{
                                    fontSize: 20,
                                    color: "#334155",
                                }}
                            >
                                Teacher workspace
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                            maxWidth: 860,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                color: "#1d4ed8",
                                fontSize: 22,
                                fontWeight: 700,
                                letterSpacing: 2,
                                textTransform: "uppercase",
                            }}
                        >
                            QR attendance + grading
                        </div>
                        <div
                            style={{
                                fontSize: 64,
                                lineHeight: 1.05,
                                fontWeight: 800,
                            }}
                        >
                            Track attendance and grades without the spreadsheet chaos.
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                flexWrap: "wrap",
                                marginTop: 8,
                            }}
                        >
                            {[
                                "QR check-ins",
                                "Student records",
                                "Grade tracking",
                                "Cleaner reports",
                            ].map((item) => (
                                <div
                                    key={item}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        padding: "12px 18px",
                                        borderRadius: 999,
                                        background: "rgba(255,255,255,0.75)",
                                        border: "1px solid rgba(148, 163, 184, 0.35)",
                                        fontSize: 22,
                                        color: "#0f172a",
                                    }}
                                >
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        ),
        size,
    );
}
