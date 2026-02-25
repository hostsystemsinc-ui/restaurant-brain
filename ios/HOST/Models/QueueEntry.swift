import Foundation

struct QueueEntry: Codable, Identifiable {
    let id:            String
    let name:          String?
    let party_size:    Int
    let status:        String          // waiting | ready | seated | removed
    let source:        String?
    let quoted_wait:   Int?
    let wait_estimate: Int?
    let position:      Int?
    let parties_ahead: Int?
    let arrival_time:  String?
    let phone:         String?
    let notes:         String?

    var isWaiting: Bool { status == "waiting" }
    var isReady:   Bool { status == "ready" }
    var isSeated:  Bool { status == "seated" }

    var displayName:  String { name?.isEmpty == false ? name! : "Guest" }
    var partySize:    Int    { party_size }
    var partiesAhead: Int?   { parties_ahead }

    var estimatedMinutes: Int {
        wait_estimate ?? quoted_wait ?? 0
    }

    var progressFraction: Double {
        guard !isReady, !isSeated else { return 1.0 }
        let original = Double(quoted_wait ?? 30)
        let remaining = Double(estimatedMinutes)
        guard original > 0 else { return 0.05 }
        return min(0.92, max(0.05, (original - remaining) / original))
    }
}

struct RestaurantTable: Codable, Identifiable {
    let id:           String
    let table_number: AnyCodable    // can be Int or String in DB
    let capacity:     Int
    let status:       String        // available | occupied | reserved

    var isAvailable: Bool { status == "available" }
    var tableNum: Int {
        if let i = table_number.value as? Int { return i }
        if let s = table_number.value as? String, let i = Int(s) { return i }
        return 0
    }
}

struct Insights: Codable {
    let tables_total:         Int
    let tables_available:     Int
    let tables_occupied:      Int
    let parties_waiting:      Int
    let parties_ready:        Int
    let avg_wait_estimate:    Int
    let capacity_utilization: Int
    let ai_insights:          String?
}

// Helper to decode Int or String from JSON
struct AnyCodable: Codable {
    let value: Any
    init(_ value: Any) { self.value = value }
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self)    { value = i; return }
        if let s = try? c.decode(String.self) { value = s; return }
        value = ""
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        if let i = value as? Int    { try c.encode(i); return }
        if let s = value as? String { try c.encode(s); return }
    }
}
