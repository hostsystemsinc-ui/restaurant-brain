import SwiftUI

private struct LiveInfo {
    let available: Int
    let waitMin:   Int?
}

struct JoinWaitlistView: View {
    @EnvironmentObject var session: SessionStore

    @State private var partySize:  Int       = 2
    @State private var name:       String    = ""
    @State private var phone:      String    = ""
    @State private var preference: String    = "asap"
    @State private var loading:    Bool      = false
    @State private var error:      String    = ""
    @State private var liveInfo:   LiveInfo? = nil

    private let preferences = [("asap", "Now"), ("15min", "15 min"), ("30min", "30 min")]

    private var restaurantName: String {
        session.sessionRestaurantName.isEmpty ? "Walter's303" : session.sessionRestaurantName
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {

                        // ── Restaurant Identity Header ─────────────────────────
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

                        VStack(alignment: .leading, spacing: 40) {

                            // Party size
                            VStack(alignment: .leading, spacing: 20) {
                                Label_("Party size")
                                HStack(spacing: 24) {
                                    CircleButton(icon: "minus") {
                                        if partySize > 1 { partySize -= 1 }
                                    }
                                    .opacity(partySize <= 1 ? 0.3 : 1)

                                    Text("\(partySize)")
                                        .font(.system(size: 56, weight: .light))
                                        .frame(width: 60, alignment: .center)
                                        .monospacedDigit()

                                    CircleButton(icon: "plus") {
                                        if partySize < 20 { partySize += 1 }
                                    }
                                    .opacity(partySize >= 20 ? 0.3 : 1)
                                }
                            }

                            Divider().overlay(Color.white.opacity(0.06))

                            // Timing
                            VStack(alignment: .leading, spacing: 16) {
                                Label_("Timing")
                                HStack(spacing: 12) {
                                    ForEach(preferences, id: \.0) { key, label in
                                        Button(label) { preference = key }
                                            .font(.system(size: 14, weight: .medium))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 12)
                                            .background(
                                                preference == key
                                                    ? Color.white
                                                    : Color.white.opacity(0.05)
                                            )
                                            .foregroundStyle(
                                                preference == key
                                                    ? Color.black
                                                    : Color.white.opacity(0.5)
                                            )
                                            .clipShape(RoundedRectangle(cornerRadius: 12))
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 12)
                                                    .strokeBorder(
                                                        preference == key
                                                            ? Color.white
                                                            : Color.white.opacity(0.08),
                                                        lineWidth: 1
                                                    )
                                            )
                                    }
                                }
                            }

                            Divider().overlay(Color.white.opacity(0.06))

                            // Name
                            VStack(alignment: .leading, spacing: 12) {
                                Label_("Name", optional: true)
                                TextField("Your name", text: $name)
                                    .textContentType(.name)
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.white)
                                    .tint(.white)
                                    .padding(.bottom, 8)
                                    .overlay(alignment: .bottom) {
                                        Rectangle()
                                            .fill(Color.white.opacity(0.15))
                                            .frame(height: 1)
                                    }
                            }

                            // Phone
                            VStack(alignment: .leading, spacing: 12) {
                                Label_("Phone", optional: true)
                                TextField("SMS when your table is ready", text: $phone)
                                    .textContentType(.telephoneNumber)
                                    .keyboardType(.phonePad)
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.white)
                                    .tint(.white)
                                    .padding(.bottom, 8)
                                    .overlay(alignment: .bottom) {
                                        Rectangle()
                                            .fill(Color.white.opacity(0.15))
                                            .frame(height: 1)
                                    }
                            }
                        }
                        .padding(.horizontal, 32)
                        .padding(.vertical, 32)

                        // CTA
                        VStack(spacing: 16) {
                            if !error.isEmpty {
                                Text(error)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.red.opacity(0.8))
                                    .multilineTextAlignment(.center)
                            }

                            Button {
                                Task { await join() }
                            } label: {
                                Group {
                                    if loading {
                                        ProgressView().tint(.black)
                                    } else {
                                        Text("Join the Waitlist")
                                            .font(.system(size: 15, weight: .semibold))
                                            .tracking(3)
                                            .textCase(.uppercase)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 64)
                                .background(loading ? Color.white.opacity(0.4) : Color.white)
                                .foregroundStyle(Color.black)
                                .clipShape(RoundedRectangle(cornerRadius: 18))
                            }
                            .disabled(loading)

                            Text("HOST · No app download needed")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.white.opacity(0.12))
                        }
                        .padding(.horizontal, 32)
                        .padding(.bottom, 48)
                    }
                }
            }
            .navigationBarHidden(true)
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

    private func join() async {
        loading = true
        error   = ""
        do {
            let joinName  = name.isEmpty  ? session.userName  : name
            let joinPhone = phone.isEmpty ? session.userPhone : phone
            let restId    = session.sessionRestaurantId.isEmpty
                                ? BackendConfig.defaultRestaurantId
                                : session.sessionRestaurantId

            let entry = try await RailwayAPI.shared.joinQueue(
                restaurantId: restId,
                name:         joinName,
                phone:        joinPhone,
                partySize:    partySize,
                preference:   preference,
                source:       "app"
            )
            session.activeEntryId = entry.id

            _ = await NotificationManager.shared.requestPermission()
            await LiveActivityManager.shared.start(entry: entry, restaurantName: restaurantName)

        } catch {
            self.error = "Something went wrong. Please try again."
        }
        loading = false
    }
}

// MARK: - Sub-components

private struct Label_: View {
    let text:     String
    var optional: Bool = false
    init(_ text: String, optional: Bool = false) { self.text = text; self.optional = optional }
    var body: some View {
        HStack(spacing: 6) {
            Text(text.uppercased())
                .font(.system(size: 11, weight: .medium))
                .tracking(3)
                .foregroundStyle(Color.white.opacity(0.35))
            if optional {
                Text("— optional")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.2))
            }
        }
    }
}

private struct CircleButton: View {
    let icon:   String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .frame(width: 44, height: 44)
                .overlay(Circle().strokeBorder(Color.white.opacity(0.15), lineWidth: 1))
        }
        .foregroundStyle(Color.white)
    }
}
