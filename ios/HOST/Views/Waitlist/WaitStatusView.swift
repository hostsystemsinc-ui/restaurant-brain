import SwiftUI

struct WaitStatusView: View {
    @EnvironmentObject var session: SessionStore
    let entryId: String

    @State private var entry:      QueueEntry? = nil
    @State private var error:      Bool        = false
    @State private var msgIndex:   Int         = 0
    @State private var pollTimer:  Timer?      = nil

    let messages = [
        "Your spot is saved — feel free to step out.",
        "We'll alert you the moment your table is ready.",
        "Sit tight, we're moving quickly.",
        "You can leave and return — we've got your spot.",
    ]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if error {
                errorView
            } else if let entry {
                contentView(entry: entry)
            } else {
                ProgressView().tint(Color.white.opacity(0.3))
            }
        }
        .task       { await poll() }
        .onDisappear { pollTimer?.invalidate() }
    }

    // MARK: Content

    @ViewBuilder
    private func contentView(entry: QueueEntry) -> some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header
            VStack(alignment: .leading, spacing: 3) {
                Text("HOST")
                    .font(.system(size: 11, weight: .medium))
                    .tracking(4)
                    .foregroundStyle(Color.white.opacity(0.2))
                if !session.sessionRestaurantName.isEmpty {
                    Text(session.sessionRestaurantName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.45))
                }
            }
            .padding(.horizontal, 32)
            .padding(.top, 60)

            Spacer()

            VStack(alignment: .leading, spacing: 40) {

                // Status headline
                VStack(alignment: .leading, spacing: 10) {
                    Text(statusLabel(entry))
                        .font(.system(size: 11, weight: .medium))
                        .tracking(3)
                        .textCase(.uppercase)
                        .foregroundStyle(Color.white.opacity(0.3))

                    Text(statusHeadline(entry))
                        .font(.system(size: 36, weight: .light))
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Progress bar
                if !entry.isSeated {
                    VStack(spacing: 10) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .fill(Color.white.opacity(0.1))
                                    .frame(height: 1)
                                Rectangle()
                                    .fill(entry.isReady ? Color.white : Color.white.opacity(0.6))
                                    .frame(width: geo.size.width * entry.progressFraction, height: 1)
                                    .animation(.easeInOut(duration: 1.5), value: entry.progressFraction)
                            }
                        }
                        .frame(height: 1)

                        HStack {
                            Text("Arrived")
                            Spacer()
                            Text(entry.isReady ? "Ready" : entry.estimatedMinutes > 0 ? "~\(entry.estimatedMinutes) min" : "Almost")
                            Spacer()
                            Text("Seated")
                        }
                        .font(.system(size: 11))
                        .foregroundStyle(Color.white.opacity(0.2))
                    }
                }

                // Info row
                if !entry.isSeated {
                    HStack {
                        infoCell(label: "Party", value: "\(entry.party_size)")
                        Spacer()
                        infoCell(
                            label: "Est. wait",
                            value: entry.isReady ? "Now" : entry.estimatedMinutes > 0 ? "\(entry.estimatedMinutes)m" : "—",
                            highlight: entry.isReady
                        )
                    }
                    .padding(.vertical, 24)
                    .overlay(alignment: .top)    { Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1) }
                    .overlay(alignment: .bottom) { Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1) }
                }

                // Rotating message
                Text(entry.isSeated ? "Thank you for dining with us."
                     : entry.isReady ? "Please make your way to the front."
                     : messages[msgIndex % messages.count])
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.4))
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(.easeInOut, value: msgIndex)
            }
            .padding(.horizontal, 32)

            Spacer()

            // Leave button
            if !entry.isSeated && !entry.isReady {
                Button("Leave & Rejoin Later") {
                    session.activeEntryId = ""
                    Task { await LiveActivityManager.shared.end(entry: entry) }
                }
                .font(.system(size: 13, weight: .medium))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(Color.white.opacity(0.35))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                )
                .padding(.horizontal, 32)
                .padding(.bottom, 48)
            }
        }
    }

    private var errorView: some View {
        VStack(spacing: 20) {
            Text("HOST").font(.system(size: 11)).tracking(4).foregroundStyle(Color.white.opacity(0.2))
            Spacer()
            Text("Entry not found").font(.title3)
            Text("This waitlist entry may have expired.")
                .font(.system(size: 14)).foregroundStyle(Color.white.opacity(0.4))
            Button("Rejoin") { session.activeEntryId = "" }
                .font(.system(size: 14, weight: .semibold)).tracking(3)
                .padding(.horizontal, 32).padding(.vertical, 14)
                .background(Color.white).foregroundStyle(Color.black)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            Spacer()
        }
        .multilineTextAlignment(.center)
    }

    // MARK: Polling

    private func poll() async {
        await fetch()
        // Start recurring poll every 5 seconds
        await MainActor.run {
            pollTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in
                Task { await self.fetch() }
            }
        }
    }

    private func fetch() async {
        guard let fetched = try? await RailwayAPI.shared.getEntry(id: entryId) else {
            error = true; return
        }
        await MainActor.run { entry = fetched }

        // Update Live Activity
        await LiveActivityManager.shared.update(entry: fetched)

        // Rotate message
        await MainActor.run { msgIndex += 1 }

        // Clear active entry once seated
        if fetched.isSeated {
            try? await Task.sleep(nanoseconds: 30_000_000_000) // 30s
            await MainActor.run { session.activeEntryId = "" }
            await LiveActivityManager.shared.end(entry: fetched)
        }
    }

    // MARK: Helpers

    private func statusLabel(_ e: QueueEntry) -> String {
        if e.isSeated { return "Enjoy your meal" }
        if e.isReady  { return "Your table is ready" }
        let ahead = e.parties_ahead ?? 0
        return ahead == 0 ? "You're next" : "\(ahead) \(ahead == 1 ? "party" : "parties") ahead"
    }

    private func statusHeadline(_ e: QueueEntry) -> String {
        if e.isSeated { return "You've been seated." }
        if e.isReady  { return "Head to the host stand." }
        let n = e.displayName
        return n == "Guest" ? "You're in line." : "Hi, \(n)."
    }

    private func infoCell(label: String, value: String, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .medium))
                .tracking(2)
                .foregroundStyle(Color.white.opacity(0.3))
            Text(value)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(highlight ? Color.white : Color.white.opacity(0.7))
        }
    }
}
