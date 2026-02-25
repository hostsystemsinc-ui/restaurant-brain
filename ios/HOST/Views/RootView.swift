import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        Group {
            if session.hasActiveEntry {
                // Customer is in an active waitlist — show live status
                WaitStatusView(entryId: session.activeEntryId)
            } else {
                // Main tab navigation
                MainTabView()
            }
        }
        .onOpenURL { url in
            // Handle NFC deep link: host://join?rid=RESTAURANT_ID
            handleDeepLink(url)
        }
    }

    private func handleDeepLink(_ url: URL) {
        // e.g. https://cooperative-reverence-production-b731.up.railway.app/join
        // or a custom scheme: host://join
        // Navigate to join flow
    }
}

struct MainTabView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        TabView {
            JoinWaitlistView()
                .tabItem {
                    Label("Join", systemImage: "plus.circle")
                }

            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person")
                }
        }
        .tint(.white)
        .preferredColorScheme(.dark)
    }
}
