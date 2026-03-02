// WaitlistLiveActivity.swift
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO ADD THIS TO YOUR PROJECT
// ─────────────────────────────────────────────────────────────────────────────
// 1. In Xcode: File → New → Target → Widget Extension
//    Name it "HOSTWidgets" and CHECK "Include Live Activity"
// 2. Add this file to the HOSTWidgets target
// 3. In HOSTWidgets Info.plist add: NSSupportsLiveActivities = YES
// Note: WaitlistActivityAttributes is defined below (self-contained).
//       The struct in NotificationManager.swift (HOST target) must match exactly.
// ─────────────────────────────────────────────────────────────────────────────

import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Shared Activity Attributes
// Must exactly match WaitlistActivityAttributes in NotificationManager.swift

struct WaitlistActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status:       String   // waiting | ready | seated
        var minutesLeft:  Int
        var partiesAhead: Int
        var progress:     Double   // 0.0 → 1.0
    }

    var entryId:    String
    var name:       String
    var partySize:  Int
    var restaurant: String
}

// MARK: - Lock Screen / Notification Banner View

struct WaitlistLockScreenView: View {
    let context: ActivityViewContext<WaitlistActivityAttributes>

    private var isReady:  Bool { context.state.status == "ready"  }
    private var isSeated: Bool { context.state.status == "seated" }

    var body: some View {
        HStack(spacing: 0) {

            // Left: branding + restaurant
            VStack(alignment: .leading, spacing: 2) {
                Text("HOST")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(3)
                    .foregroundStyle(.white.opacity(0.35))
                Text(context.attributes.restaurant)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Text("\(context.attributes.partySize) guest\(context.attributes.partySize == 1 ? "" : "s")")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(.leading, 16)

            Spacer()

            // Center: progress bar + labels
            if !isSeated {
                VStack(spacing: 5) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.12))
                                .frame(height: 2)
                            Capsule()
                                .fill(isReady ? Color.green : Color.white.opacity(0.75))
                                .frame(width: geo.size.width * context.state.progress, height: 2)
                        }
                    }
                    .frame(height: 2)

                    HStack {
                        Text("Arrived")
                        Spacer()
                        Text(isReady ? "Ready!" :
                             context.state.partiesAhead == 0 ? "You're next" :
                             "\(context.state.partiesAhead) ahead")
                            .foregroundStyle(isReady ? .green : .white.opacity(0.45))
                        Spacer()
                        Text("Seated")
                    }
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.3))
                }
                .frame(maxWidth: 160)
            }

            Spacer()

            // Right: time or checkmark
            VStack(alignment: .trailing, spacing: 2) {
                if isSeated {
                    Image(systemName: "fork.knife")
                        .font(.system(size: 18))
                        .foregroundStyle(.white.opacity(0.5))
                } else if isReady {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(.green)
                } else if context.state.minutesLeft > 0 {
                    Text("~\(context.state.minutesLeft)")
                        .font(.system(size: 22, weight: .light))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                    Text("min")
                        .font(.system(size: 9))
                        .foregroundStyle(.white.opacity(0.4))
                } else {
                    Text("—")
                        .font(.system(size: 22, weight: .light))
                        .foregroundStyle(.white.opacity(0.3))
                }
            }
            .padding(.trailing, 16)
        }
        .padding(.vertical, 14)
        .activityBackgroundTint(.black)
    }
}

// MARK: - Widget Configuration

@available(iOS 16.1, *)
struct WaitlistLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WaitlistActivityAttributes.self) { context in

            // ── Lock Screen / Banner ──────────────────────────────────────────
            WaitlistLockScreenView(context: context)

        } dynamicIsland: { context in

            let isReady  = context.state.status == "ready"
            let isSeated = context.state.status == "seated"

            DynamicIsland {

                // ── Expanded ─────────────────────────────────────────────────
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("HOST")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(3)
                            .foregroundStyle(.white.opacity(0.3))
                        Text(context.attributes.restaurant)
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        if isReady {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                                .font(.system(size: 22))
                        } else if isSeated {
                            Image(systemName: "fork.knife")
                                .font(.system(size: 18))
                                .foregroundStyle(.white.opacity(0.5))
                        } else if context.state.minutesLeft > 0 {
                            Text("~\(context.state.minutesLeft)m")
                                .font(.system(size: 18, weight: .light))
                                .monospacedDigit()
                            Text("est. wait")
                                .font(.system(size: 9))
                                .foregroundStyle(.white.opacity(0.4))
                        } else {
                            Text("—")
                                .font(.system(size: 18, weight: .light))
                                .foregroundStyle(.white.opacity(0.3))
                        }
                    }
                    .padding(.trailing, 4)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        // Progress bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.white.opacity(0.1))
                                    .frame(height: 2)
                                Capsule()
                                    .fill(isReady ? Color.green : Color.white.opacity(0.7))
                                    .frame(
                                        width: geo.size.width * context.state.progress,
                                        height: 2
                                    )
                            }
                        }
                        .frame(height: 2)

                        HStack {
                            Text("Arrived")
                            Spacer()
                            if isReady {
                                Text("Table ready!")
                                    .foregroundStyle(.green)
                            } else {
                                Text(context.state.partiesAhead == 0
                                    ? "You're next"
                                    : "\(context.state.partiesAhead) \(context.state.partiesAhead == 1 ? "party" : "parties") ahead")
                            }
                            Spacer()
                            Text("Seated")
                        }
                        .font(.system(size: 9))
                        .foregroundStyle(.white.opacity(0.3))
                    }
                    .padding(.horizontal, 4)
                    .padding(.bottom, 4)
                }

            } compactLeading: {

                // ── Compact Leading ───────────────────────────────────────────
                Image(systemName: isReady ? "checkmark.circle.fill" : "fork.knife")
                    .font(.system(size: 12, weight: isReady ? .bold : .regular))
                    .foregroundStyle(isReady ? .green : .white)

            } compactTrailing: {

                // ── Compact Trailing ──────────────────────────────────────────
                if isReady {
                    Text("Ready")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.green)
                } else {
                    Text(context.state.minutesLeft > 0
                        ? "\(context.state.minutesLeft)m"
                        : "—")
                        .font(.system(size: 12, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                }

            } minimal: {

                // ── Minimal (pill when two activities) ───────────────────────
                Image(systemName: isReady
                    ? "checkmark.circle.fill"
                    : "fork.knife")
                    .font(.system(size: 12))
                    .foregroundStyle(isReady ? .green : .white.opacity(0.7))
            }
        }
    }
}

// MARK: - Preview

@available(iOS 16.2, *)
#Preview("Lock Screen", as: .content,
         using: WaitlistActivityAttributes(
            entryId: "preview",
            name: "Alex",
            partySize: 3,
            restaurant: "Walter's303"
         )
) {
    WaitlistLiveActivityWidget()
} contentStates: {
    WaitlistActivityAttributes.ContentState(
        status: "waiting", minutesLeft: 14, partiesAhead: 2, progress: 0.3
    )
    WaitlistActivityAttributes.ContentState(
        status: "ready", minutesLeft: 0, partiesAhead: 0, progress: 0.95
    )
}
