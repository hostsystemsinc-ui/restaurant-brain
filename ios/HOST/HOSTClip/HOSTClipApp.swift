import SwiftUI

@main
struct HOSTClipApp: App {
    var body: some Scene {
        WindowGroup {
            ClipRootView()
                .preferredColorScheme(.dark)
        }
    }
}

/// Reads the restaurant ID (and derives the name) from the NFC/universal-link
/// URL passed via the App Clip experience. Falls back to the default restaurant.
struct ClipRootView: View {
    @State private var restaurantId:   String = BackendConfig.defaultRestaurantId
    @State private var restaurantName: String = "Walter's303"
    @State private var joined  = false
    @State private var entryId: String = ""

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if joined && !entryId.isEmpty {
                ClipWaitView(entryId: entryId, restaurantName: restaurantName)
            } else {
                ClipJoinView(restaurantId: restaurantId, restaurantName: restaurantName) { id in
                    entryId = id
                    joined  = true
                }
            }
        }
        .onContinueUserActivity(NSUserActivityTypes.appClipActivation) { activity in
            if let url = activity.webpageURL,
               let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
               let rid = components.queryItems?.first(where: { $0.name == "r" })?.value {
                restaurantId   = rid
                restaurantName = rid == BackendConfig.defaultRestaurantId ? "Walter's303" : "HOST"
            }
        }
    }
}

// Expose the App Clip activation type string
private enum NSUserActivityTypes {
    static let appClipActivation = "NSUserActivityTypeBrowsingWeb"
}
