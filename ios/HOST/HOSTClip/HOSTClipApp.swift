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

/// Reads the restaurant ID from the NFC/universal-link URL passed via the App Clip
/// experience. Falls back to the default restaurant if none is provided.
struct ClipRootView: View {
    @State private var restaurantId: String = BackendConfig.defaultRestaurantId
    @State private var joined        = false
    @State private var entryId:   String = ""

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if joined && !entryId.isEmpty {
                ClipWaitView(entryId: entryId)
            } else {
                ClipJoinView(restaurantId: restaurantId) { id in
                    entryId = id
                    joined  = true
                }
            }
        }
        .onContinueUserActivity(NSUserActivityTypes.appClipActivation) { activity in
            if let url = activity.webpageURL,
               let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
               let rid = components.queryItems?.first(where: { $0.name == "r" })?.value {
                restaurantId = rid
            }
        }
    }
}

// Expose the App Clip activation type string
private enum NSUserActivityTypes {
    static let appClipActivation = "NSUserActivityTypeBrowsingWeb"
}
