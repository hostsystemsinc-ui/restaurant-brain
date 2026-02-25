import Foundation
import Supabase

// MARK: - User Profile

struct UserProfile: Codable {
    let id:         String
    var name:       String?
    var phone:      String?
    var email:      String?
}

// MARK: - Supabase Manager

actor SupabaseManager {
    static let shared = SupabaseManager()

    let client = SupabaseClient(
        supabaseURL: URL(string: "https://fnudixriqaduwvwwgoye.supabase.co")!,
        supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudWRpeHJpcWFkdXd2d3dnb3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzMyNzcsImV4cCI6MjA4Njk0OTI3N30.2hQ7hjNH0XkFBsj5YYhQrTr9JpwWlpG6jzj5uxeogSQ"
    )

    // MARK: Auth

    var currentUser: User? {
        get async { try? await client.auth.user() }
    }

    var isSignedIn: Bool {
        get async { await currentUser != nil }
    }

    func signUp(email: String, password: String) async throws -> User {
        let res = try await client.auth.signUp(email: email, password: password)
        return res.user
    }

    func signIn(email: String, password: String) async throws -> User {
        let res = try await client.auth.signIn(email: email, password: password)
        return res.user
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    // MARK: Profile

    func getProfile(userId: String) async throws -> UserProfile? {
        let res: [UserProfile] = try await client
            .from("profiles")
            .select()
            .eq("id", value: userId)
            .execute()
            .value
        return res.first
    }

    func upsertProfile(_ profile: UserProfile) async throws {
        try await client
            .from("profiles")
            .upsert(profile)
            .execute()
    }

    // MARK: Visit History

    func getVisitHistory(userId: String) async throws -> [VisitRecord] {
        let res: [VisitRecord] = try await client
            .from("queue_entries")
            .select("id, restaurant_id, party_size, status, arrival_time")
            .eq("user_id", value: userId)
            .order("arrival_time", ascending: false)
            .limit(30)
            .execute()
            .value
        return res
    }
}
