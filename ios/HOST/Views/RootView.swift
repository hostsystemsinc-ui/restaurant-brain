import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        Group {
            if session.hasActiveEntry {
                WaitStatusView(entryId: session.activeEntryId)
                    .transition(.opacity)
            } else {
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.hasActiveEntry)
        .onOpenURL { url in handleDeepLink(url) }
    }

    private func handleDeepLink(_ url: URL) {
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        guard let rid = comps?.queryItems?.first(where: { $0.name == "r" || $0.name == "rid" })?.value,
              !rid.isEmpty else { return }
        session.sessionRestaurantId   = rid
        // Map known restaurant IDs to display names; will expand to API lookup in future
        session.sessionRestaurantName = rid == BackendConfig.defaultRestaurantId
            ? "Walter's303"
            : "HOST"
    }
}

// MARK: - Main Tab View

struct MainTabView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        TabView {
            joinTab
                .tabItem { Label("Join", systemImage: "plus.circle") }

            HistoryView()
                .tabItem { Label("History", systemImage: "clock") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person") }
        }
        .tint(.white)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var joinTab: some View {
        if session.hasRestaurant {
            JoinWaitlistView()
        } else {
            NFCTapView()
        }
    }
}

// MARK: - NFC Tap View

struct NFCTapView: View {
    @State private var isPulsing = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Wordmark ──────────────────────────────────────────────────
                VStack(spacing: 5) {
                    Text("Powered by")
                        .font(.system(size: 10, weight: .medium))
                        .tracking(4)
                        .textCase(.uppercase)
                        .foregroundStyle(Color.white.opacity(0.3))
                    Text("HOST")
                        .font(.system(size: 32, weight: .bold))
                        .tracking(10)
                        .foregroundStyle(Color.white)
                }
                .padding(.top, 68)

                Spacer()

                // ── NFC Pulse Rings + Phone Icon ──────────────────────────────
                ZStack {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                            .frame(
                                width:  120 + CGFloat(i * 58),
                                height: 120 + CGFloat(i * 58)
                            )
                            .scaleEffect(isPulsing ? 1.55 + CGFloat(i) * 0.28 : 1.0)
                            .opacity(isPulsing ? 0 : 1)
                            .animation(
                                .easeOut(duration: 2.0)
                                    .repeatForever(autoreverses: false)
                                    .delay(Double(i) * 0.55),
                                value: isPulsing
                            )
                    }

                    Image(systemName: "iphone.radiowaves.left.and.right")
                        .font(.system(size: 64, weight: .ultraLight))
                        .foregroundStyle(Color.white.opacity(0.9))
                }
                .frame(height: 280)

                // ── Tap Prompt ────────────────────────────────────────────────
                VStack(spacing: 14) {
                    Text("TAP NOW")
                        .font(.system(size: 30, weight: .light))
                        .tracking(10)
                        .foregroundStyle(Color.white)

                    Text("Hold your phone near the HOST stand\nto check in")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.35))
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }

                Spacer()

                // ── Footer ────────────────────────────────────────────────────
                Text("HOST · Seamless guest experiences")
                    .font(.system(size: 10))
                    .tracking(1)
                    .foregroundStyle(Color.white.opacity(0.1))
                    .padding(.bottom, 24)
            }
            .padding(.horizontal, 32)
        }
        .onAppear { isPulsing = true }
    }
}
