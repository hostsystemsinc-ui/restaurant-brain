import SwiftUI

/// Live wait-status screen shown after joining via the App Clip.
/// Polls every 5 s and keeps the Live Activity updated.
struct ClipWaitView: View {
    let entryId:        String
    var restaurantName: String = "HOST"

    @State private var entry: QueueEntry? = nil
    @State private var dots  = ""
    @State private var error = false

    private let pollInterval: TimeInterval = 5

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if error {
                notFoundView
            } else if let entry {
                statusView(entry)
            } else {
                ProgressView().progressViewStyle(.circular).tint(Color.white.opacity(0.4))
            }
        }
        .onAppear { startPolling() }
    }

    // MARK: - Status View

    private func statusView(_ e: QueueEntry) -> some View {
        VStack(spacing: 0) {

            // ── Wordmark ─────────────────────────────────────────────────────
            VStack(spacing: 3) {
                Text("HOST")
                    .font(.system(size: 11, weight: .bold)).tracking(6)
                    .foregroundStyle(Color.white.opacity(0.2))
                Text(restaurantName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.45))
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 56)

            Spacer()

            VStack(spacing: 28) {

                // ── Status headline ──────────────────────────────────────────
                VStack(spacing: 10) {
                    Text(headlineText(e))
                        .font(.system(size: 30, weight: .light))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.white)

                    if let ahead = e.partiesAhead, e.isWaiting {
                        Text(ahead == 0 ? "You're next" :
                             "\(ahead) \(ahead == 1 ? "party" : "parties") ahead")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.white.opacity(0.4))
                    }
                }

                // ── Progress bar ─────────────────────────────────────────────
                if !e.isSeated {
                    VStack(spacing: 8) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .fill(Color.white.opacity(0.08))
                                Rectangle()
                                    .fill(Color.white.opacity(0.6))
                                    .frame(width: geo.size.width * e.progressFraction)
                                    .animation(.easeInOut(duration: 1), value: e.progressFraction)
                            }
                        }
                        .frame(height: 1)

                        HStack {
                            Text("Arrived")
                            Spacer()
                            Text(e.isReady ? "Ready" :
                                 e.estimatedMinutes > 0 ? "~\(e.estimatedMinutes)m" : "Soon")
                            Spacer()
                            Text("Seated")
                        }
                        .font(.system(size: 10)).tracking(1)
                        .foregroundStyle(Color.white.opacity(0.25))
                    }
                    .padding(.horizontal, 40)
                }

                // ── Party pill ───────────────────────────────────────────────
                HStack(spacing: 6) {
                    Image(systemName: "person.2")
                        .font(.system(size: 12))
                    Text("\(e.partySize) guest\(e.partySize == 1 ? "" : "s")")
                        .font(.system(size: 13))
                }
                .foregroundStyle(Color.white.opacity(0.35))

                // ── Rotating message ─────────────────────────────────────────
                if e.isWaiting {
                    Text("Your spot is saved\(dots)")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.white.opacity(0.3))
                        .animation(.easeInOut, value: dots)
                }
            }
            .padding(.horizontal, 32)

            Spacer()

            // ── Footer / leave ────────────────────────────────────────────────
            if !e.isSeated && !e.isReady {
                Text("This page updates automatically")
                    .font(.system(size: 10)).tracking(1)
                    .foregroundStyle(Color.white.opacity(0.15))
                    .padding(.bottom, 44)
            }
        }
    }

    private func headlineText(_ e: QueueEntry) -> String {
        if e.isSeated { return "You've been seated." }
        if e.isReady  { return "Your table is ready." }
        if let name = e.name, !name.isEmpty, name != "Guest" {
            return "Hey, \(name)."
        }
        return "You're in line."
    }

    // MARK: - Not Found

    private var notFoundView: some View {
        VStack(spacing: 16) {
            Text("HOST")
                .font(.system(size: 14, weight: .bold)).tracking(6)
                .foregroundStyle(Color.white.opacity(0.25))
            Spacer()
            Text("Entry not found.")
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(Color.white.opacity(0.6))
            Text("This entry may have been removed.")
                .font(.system(size: 13))
                .foregroundStyle(Color.white.opacity(0.3))
            Spacer()
        }
        .padding(.top, 56)
    }

    // MARK: - Polling

    private func startPolling() {
        Task { await poll() }
        // Animated dots
        Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 500_000_000)
                await MainActor.run {
                    dots = dots.count >= 3 ? "" : dots + "."
                }
            }
        }
        // Repeated poll
        Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
                await poll()
            }
        }
    }

    @MainActor
    private func poll() async {
        do {
            let updated = try await RailwayAPI.shared.getEntry(id: entryId)
            entry = updated

            // Sync Live Activity
            await LiveActivityManager.shared.update(
                status:       updated.status,
                minutesLeft:  updated.estimatedMinutes,
                partiesAhead: updated.partiesAhead ?? 0,
                progress:     updated.progressFraction
            )

            // Local notification when ready
            if updated.isReady {
                await NotificationManager.shared.sendReadyNotification(
                    name: updated.name ?? "Your party"
                )
            }

            // End Live Activity when seated
            if updated.isSeated {
                await LiveActivityManager.shared.end()
            }
        } catch {
            self.error = true
        }
    }
}
