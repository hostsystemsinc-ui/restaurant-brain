import SwiftUI

private struct LiveInfo {
    let available: Int
    let waitMin:   Int?
}

/// NFC-triggered join screen for the HOST App Clip.
/// Mirrors the web join page: restaurant identity header, live availability, party size, fields, CTA.
struct ClipJoinView: View {
    let restaurantId:   String
    let restaurantName: String
    let onJoined: (String) -> Void

    @State private var partySize  = 2
    @State private var name       = ""
    @State private var phone      = ""
    @State private var preference = "asap"
    @State private var loading    = false
    @State private var error      = ""
    @State private var liveInfo:  LiveInfo? = nil

    private let timingOptions: [(key: String, label: String)] = [
        ("asap",  "Now"),
        ("15min", "15 min"),
        ("30min", "30 min"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // ── Restaurant Identity Header ────────────────────────────────────
            VStack(alignment: .leading, spacing: 12) {

                // Avatar
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color.white.opacity(0.07))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(Color.white.opacity(0.13), lineWidth: 1)
                        )
                    Text(String(restaurantName.prefix(1)).uppercased())
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.85))
                }
                .frame(width: 54, height: 54)

                // Name
                Text(restaurantName)
                    .font(.system(size: 20, weight: .semibold))
                    .tracking(0.3)
                    .foregroundStyle(Color.white.opacity(0.9))

                // Live availability
                if let info = liveInfo {
                    liveInfoRow(info)
                } else {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white.opacity(0.07))
                        .frame(width: 200, height: 14)
                }
            }
            .padding(.horizontal, 32)
            .padding(.top, 56)
            .padding(.bottom, 28)

            Divider().overlay(Color.white.opacity(0.08))

            ScrollView {
                VStack(alignment: .leading, spacing: 32) {

                    // ── Party Size ───────────────────────────────────────────
                    VStack(alignment: .leading, spacing: 16) {
                        sectionLabel("Party size")
                        HStack(spacing: 24) {
                            stepperButton(systemName: "minus") {
                                if partySize > 1 { partySize -= 1 }
                            }
                            .opacity(partySize <= 1 ? 0.3 : 1)
                            .disabled(partySize <= 1)

                            Text("\(partySize)")
                                .font(.system(size: 56, weight: .light))
                                .frame(width: 60, alignment: .center)
                                .monospacedDigit()

                            stepperButton(systemName: "plus") {
                                if partySize < 20 { partySize += 1 }
                            }
                            .opacity(partySize >= 20 ? 0.3 : 1)
                            .disabled(partySize >= 20)
                        }
                    }

                    Divider().overlay(Color.white.opacity(0.06))

                    // ── Timing ───────────────────────────────────────────────
                    VStack(alignment: .leading, spacing: 14) {
                        sectionLabel("Timing")
                        HStack(spacing: 10) {
                            ForEach(timingOptions, id: \.key) { option in
                                timingPill(option)
                            }
                        }
                    }

                    Divider().overlay(Color.white.opacity(0.06))

                    // ── Optional fields ──────────────────────────────────────
                    VStack(alignment: .leading, spacing: 20) {
                        underlineField(label: "Name", placeholder: "Your name",
                                       text: $name, keyboard: .default)
                        underlineField(label: "Phone", placeholder: "SMS when your table is ready",
                                       text: $phone, keyboard: .phonePad)
                    }
                }
                .padding(.horizontal, 32)
                .padding(.top, 28)
                .padding(.bottom, 16)
            }

            Spacer(minLength: 0)

            // ── CTA ──────────────────────────────────────────────────────────
            VStack(spacing: 0) {
                if !error.isEmpty {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.red.opacity(0.75))
                        .padding(.bottom, 10)
                        .multilineTextAlignment(.center)
                }

                Button(action: join) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 18)
                            .fill(loading ? Color.white.opacity(0.4) : Color.white)
                        if loading {
                            ProgressView().progressViewStyle(.circular).tint(.black)
                        } else {
                            Text("Join the Waitlist")
                                .font(.system(size: 14, weight: .semibold))
                                .tracking(3)
                                .textCase(.uppercase)
                                .foregroundStyle(Color.black)
                        }
                    }
                    .frame(height: 64)
                }
                .disabled(loading)

                Text("HOST · No app download needed")
                    .font(.system(size: 10))
                    .tracking(1)
                    .foregroundStyle(Color.white.opacity(0.12))
                    .padding(.top, 14)
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 44)
        }
        .task { await loadLive() }
    }

    // MARK: - Live Info Row

    @ViewBuilder
    private func liveInfoRow(_ info: LiveInfo) -> some View {
        HStack(spacing: 6) {
            if info.available > 0 {
                Text("\(info.available) \(info.available == 1 ? "table" : "tables") available")
                    .foregroundStyle(Color(red: 0.39, green: 0.90, blue: 0.51))
                    .fontWeight(.semibold)
                Text("—")
                    .foregroundStyle(Color.white.opacity(0.35))
                if let w = info.waitMin {
                    Text("~\(w)m wait")
                        .foregroundStyle(Color.white.opacity(0.5))
                } else {
                    Text("no wait")
                        .foregroundStyle(Color.white.opacity(0.5))
                }
            } else {
                if let w = info.waitMin {
                    Text("All tables occupied · ~\(w)m wait")
                        .foregroundStyle(Color.white.opacity(0.5))
                } else {
                    Text("All tables occupied")
                        .foregroundStyle(Color.white.opacity(0.5))
                }
            }
        }
        .font(.system(size: 13))
    }

    // MARK: - Component Helpers

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium)).tracking(4)
            .textCase(.uppercase)
            .foregroundStyle(Color.white.opacity(0.35))
    }

    private func stepperButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .regular))
                .frame(width: 44, height: 44)
                .overlay(
                    RoundedRectangle(cornerRadius: 22)
                        .strokeBorder(Color.white.opacity(0.15))
                )
        }
        .foregroundStyle(Color.white)
    }

    private func timingPill(_ option: (key: String, label: String)) -> some View {
        let selected = preference == option.key
        return Button(option.label) { preference = option.key }
            .font(.system(size: 13, weight: .medium))
            .frame(maxWidth: .infinity).frame(height: 42)
            .background(selected ? Color.white : Color.white.opacity(0.05))
            .foregroundStyle(selected ? Color.black : Color.white.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(selected ? Color.white : Color.white.opacity(0.08))
            )
    }

    private func underlineField(label: String, placeholder: String,
                                text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 11, weight: .medium)).tracking(4)
                .textCase(.uppercase)
                .foregroundStyle(Color.white.opacity(0.35))
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .font(.system(size: 16, weight: .light))
                .foregroundStyle(Color.white)
                .tint(.white)
            Rectangle()
                .fill(Color.white.opacity(0.15))
                .frame(height: 1)
        }
    }

    // MARK: - Data Loading

    private func loadLive() async {
        async let tablesTask   = RailwayAPI.shared.getTables()
        async let insightsTask = RailwayAPI.shared.getInsights()

        let tables   = (try? await tablesTask)   ?? []
        let insights = try? await insightsTask

        let apiOccupied = tables.filter { !$0.isAvailable }.count
        let available   = max(0, 16 - apiOccupied)
        let waitMin: Int? = {
            guard let m = insights?.avg_wait_estimate, m > 0 else { return nil }
            return m
        }()
        liveInfo = LiveInfo(available: available, waitMin: waitMin)
    }

    // MARK: - Join

    private func join() {
        loading = true
        error   = ""
        Task {
            do {
                let entry = try await RailwayAPI.shared.joinQueue(
                    restaurantId: restaurantId,
                    name:         name.trimmingCharacters(in: .whitespaces).nilIfEmpty,
                    phone:        phone.trimmingCharacters(in: .whitespaces).nilIfEmpty,
                    partySize:    partySize,
                    preference:   preference,
                    source:       "appclip"
                )
                await NotificationManager.shared.requestPermission()
                await LiveActivityManager.shared.start(
                    entryId:        entry.id,
                    name:           entry.name,
                    partySize:      entry.partySize,
                    minutesLeft:    entry.estimatedMinutes,
                    partiesAhead:   entry.partiesAhead ?? 0,
                    progress:       entry.progressFraction,
                    restaurantName: restaurantName
                )
                await MainActor.run { onJoined(entry.id) }
            } catch {
                await MainActor.run {
                    self.error   = "Something went wrong. Please try again."
                    self.loading = false
                }
            }
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
