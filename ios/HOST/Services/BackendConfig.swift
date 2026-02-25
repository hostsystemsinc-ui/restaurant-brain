import Foundation

enum BackendConfig {
    static let apiBase            = "https://restaurant-brain-production.up.railway.app"
    static let dashboardBase      = "https://cooperative-reverence-production-b731.up.railway.app"
    static let defaultRestaurantId = "272a8876-e4e6-4867-831d-0525db80a8db"

    // Endpoints
    static func queue(restaurantId: String? = nil) -> URL {
        URL(string: "\(apiBase)/queue")!
    }
    static func joinQueue()   -> URL { URL(string: "\(apiBase)/queue/join")! }
    static func entryStatus(_ id: String) -> URL { URL(string: "\(apiBase)/queue/\(id)")! }
    static func seatEntry(_ id: String)   -> URL { URL(string: "\(apiBase)/queue/\(id)/seat")! }
    static func notifyEntry(_ id: String) -> URL { URL(string: "\(apiBase)/queue/\(id)/notify")! }
    static func removeEntry(_ id: String) -> URL { URL(string: "\(apiBase)/queue/\(id)/remove")! }
    static func tables()   -> URL { URL(string: "\(apiBase)/tables")! }
    static func insights() -> URL { URL(string: "\(apiBase)/insights")! }
    static func restaurant() -> URL { URL(string: "\(apiBase)/restaurant")! }
}
