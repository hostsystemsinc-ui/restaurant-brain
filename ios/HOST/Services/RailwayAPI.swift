import Foundation

// MARK: - Request / Response Models

struct JoinQueueRequest: Codable {
    let name:          String?
    let party_size:    Int
    let phone:         String?
    let preference:    String
    let source:        String
    let restaurant_id: String?
}

struct JoinQueueResponse: Codable {
    let status:        String
    let entry:         QueueEntry
    let wait_estimate: Int
    let position:      Int
}

// MARK: - API

actor RailwayAPI {
    static let shared = RailwayAPI()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    // MARK: Queue

    func joinQueue(
        restaurantId: String? = nil,
        name:         String?,
        phone:        String?,
        partySize:    Int,
        preference:   String,
        source:       String = "app"
    ) async throws -> QueueEntry {
        var req = URLRequest(url: BackendConfig.joinQueue())
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = JoinQueueRequest(
            name:          name?.isEmpty == false ? name : nil,
            party_size:    partySize,
            phone:         phone?.isEmpty == false ? phone : nil,
            preference:    preference,
            source:        source,
            restaurant_id: restaurantId ?? BackendConfig.defaultRestaurantId
        )
        req.httpBody = try JSONEncoder().encode(body)
        let (data, _) = try await URLSession.shared.data(for: req)
        let response  = try decoder.decode(JoinQueueResponse.self, from: data)
        return response.entry
    }

    func getEntry(id: String) async throws -> QueueEntry {
        let (data, _) = try await URLSession.shared.data(from: BackendConfig.entryStatus(id))
        return try decoder.decode(QueueEntry.self, from: data)
    }

    func getQueue() async throws -> [QueueEntry] {
        let (data, _) = try await URLSession.shared.data(from: BackendConfig.queue())
        return try decoder.decode([QueueEntry].self, from: data)
    }

    func getTables() async throws -> [RestaurantTable] {
        let (data, _) = try await URLSession.shared.data(from: BackendConfig.tables())
        return try decoder.decode([RestaurantTable].self, from: data)
    }

    func getInsights() async throws -> Insights {
        let (data, _) = try await URLSession.shared.data(from: BackendConfig.insights())
        return try decoder.decode(Insights.self, from: data)
    }

    func seatEntry(_ id: String) async throws {
        var req = URLRequest(url: BackendConfig.seatEntry(id))
        req.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: req)
    }

    func notifyEntry(_ id: String) async throws {
        var req = URLRequest(url: BackendConfig.notifyEntry(id))
        req.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: req)
    }

    func removeEntry(_ id: String) async throws {
        var req = URLRequest(url: BackendConfig.removeEntry(id))
        req.httpMethod = "POST"
        _ = try await URLSession.shared.data(for: req)
    }
}
