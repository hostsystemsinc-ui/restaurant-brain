import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if session.isSignedIn {
                historyList
            } else {
                AuthView()
            }
        }
    }

    private var historyList: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                Text("Visits")
                    .font(.system(size: 11, weight: .medium)).tracking(4)
                    .textCase(.uppercase).foregroundStyle(Color.white.opacity(0.35))
                Text("History")
                    .font(.system(size: 36, weight: .light))
            }
            .padding(.horizontal, 32).padding(.top, 60).padding(.bottom, 32)

            Divider().overlay(Color.white.opacity(0.08))

            if session.visitHistory.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(session.visitHistory) { visit in
                            visitRow(visit)
                        }
                    }
                    .padding(.top, 8)
                }
            }
        }
        .onAppear { Task { await session.loadVisitHistory() } }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("No visits yet")
                .font(.system(size: 17, weight: .light))
                .foregroundStyle(Color.white.opacity(0.3))
            Text("Your waitlist history will appear here.")
                .font(.system(size: 13))
                .foregroundStyle(Color.white.opacity(0.2))
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
    }

    private func visitRow(_ visit: VisitRecord) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text(visit.restaurantName ?? "Restaurant")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.85))
                Text(visit.formattedDate)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.white.opacity(0.35))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(visit.partySize) guest\(visit.partySize == 1 ? "" : "s")")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.white.opacity(0.5))
                statusBadge(visit.status)
            }
        }
        .padding(.horizontal, 32).padding(.vertical, 20)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1).padding(.horizontal, 32)
        }
    }

    @ViewBuilder
    private func statusBadge(_ status: String) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "seated":  return ("Seated",  Color.white.opacity(0.5))
            case "ready":   return ("Ready",   Color.green.opacity(0.7))
            case "removed": return ("Left",    Color.white.opacity(0.25))
            default:        return ("Waiting", Color.orange.opacity(0.6))
            }
        }()
        Text(label)
            .font(.system(size: 10, weight: .medium)).tracking(2)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}
