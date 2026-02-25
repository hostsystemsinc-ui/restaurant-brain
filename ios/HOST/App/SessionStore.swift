import SwiftUI
import Combine

// MARK: - Visit History Model
struct VisitRecord: Identifiable, Codable {
    let id: String
    let restaurantId: String?
    let restaurantName: String?
    let partySize: Int
    let status: String
    let arrivalTime: String

    var formattedDate: String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let simple = ISO8601DateFormatter()
        if let date = iso.date(from: arrivalTime) ?? simple.date(from: arrivalTime) {
            let df = DateFormatter()
            df.dateStyle = .medium
            df.timeStyle = .short
            return df.string(from: date)
        }
        return arrivalTime
    }

    enum CodingKeys: String, CodingKey {
        case id
        case restaurantId   = "restaurant_id"
        case restaurantName = "restaurant_name"
        case partySize      = "party_size"
        case status
        case arrivalTime    = "arrival_time"
    }
}

// MARK: - Session Store
@MainActor
class SessionStore: ObservableObject {
    @Published var isSignedIn    = false
    @Published var userName:  String? = nil
    @Published var userPhone: String? = nil
    @Published var visitHistory: [VisitRecord] = []

    // Active waitlist entry (persisted across app launches)
    @AppStorage("activeEntryId") var activeEntryId: String = ""

    var hasActiveEntry: Bool { !activeEntryId.isEmpty }

    init() {
        Task { await checkSession() }
    }

    func checkSession() async {
        isSignedIn = await SupabaseManager.shared.isSignedIn
        if isSignedIn, let user = await SupabaseManager.shared.currentUser {
            if let profile = try? await SupabaseManager.shared.getProfile(userId: user.id.uuidString) {
                userName  = profile.name
                userPhone = profile.phone
            }
        }
    }

    func loadVisitHistory() async {
        guard isSignedIn, let user = await SupabaseManager.shared.currentUser else { return }
        if let records = try? await SupabaseManager.shared.getVisitHistory(userId: user.id.uuidString) {
            visitHistory = records
        }
    }

    func signOut() {
        Task {
            try? await SupabaseManager.shared.signOut()
            isSignedIn    = false
            userName      = nil
            visitHistory  = []
            activeEntryId = ""
        }
    }
}
