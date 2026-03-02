import UserNotifications
import Foundation

// MARK: - Live Activity model (iOS 16.1+)
// Requires ActivityKit — add to target in Xcode: import ActivityKit

// MARK: - Push Notifications

actor NotificationManager {
    static let shared = NotificationManager()

    // Request permission
    func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        return granted
    }

    // Schedule a local notification for when table is ready
    func scheduleReadyNotification(name: String, partySize: Int) {
        let content           = UNMutableNotificationContent()
        content.title         = "Your table is ready, \(name)!"
        content.body          = "Party of \(partySize) — please head to the host stand."
        content.sound         = .default
        content.interruptionLevel = .timeSensitive

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: "table-ready", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    // Convenience: fire ready notification without party size
    func sendReadyNotification(name: String) {
        scheduleReadyNotification(name: name, partySize: 0)
    }

    // Schedule a wait-time update notification
    func scheduleWaitUpdate(minutesRemaining: Int) {
        let content = UNMutableNotificationContent()
        content.title = "Almost time!"
        content.body  = "Your table should be ready in about \(minutesRemaining) minutes."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: "wait-update", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}

// MARK: - Live Activity (Lock Screen widget)
// This requires ActivityKit framework and a Widget Extension target.
// The ActivityAttributes below defines the data shape for the lock screen widget.
// To enable: File → New → Target → Widget Extension → check "Include Live Activity"

import ActivityKit

struct WaitlistActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var status:        String   // waiting | ready | seated
        var minutesLeft:   Int
        var partiesAhead:  Int
        var progress:      Double   // 0.0 → 1.0
    }

    var entryId:    String
    var name:       String
    var partySize:  Int
    var restaurant: String
}

actor LiveActivityManager {
    static let shared = LiveActivityManager()

    private var activity: Activity<WaitlistActivityAttributes>?

    // ── Full QueueEntry variant (used by main app) ─────────────────────────

    func start(entry: QueueEntry, restaurantName: String) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attrs = WaitlistActivityAttributes(
            entryId:    entry.id,
            name:       entry.displayName,
            partySize:  entry.party_size,
            restaurant: restaurantName
        )
        let state = WaitlistActivityAttributes.ContentState(
            status:       entry.status,
            minutesLeft:  entry.estimatedMinutes,
            partiesAhead: entry.parties_ahead ?? 0,
            progress:     entry.progressFraction
        )

        activity = try? Activity.request(
            attributes: attrs,
            contentState: state,
            pushType: nil
        )
    }

    func update(entry: QueueEntry) async {
        let state = WaitlistActivityAttributes.ContentState(
            status:       entry.status,
            minutesLeft:  entry.estimatedMinutes,
            partiesAhead: entry.parties_ahead ?? 0,
            progress:     entry.progressFraction
        )
        await activity?.update(using: state)

        if entry.isReady {
            await NotificationManager.shared.scheduleReadyNotification(
                name:      entry.displayName,
                partySize: entry.party_size
            )
        }
    }

    func end(entry: QueueEntry) async {
        let finalState = WaitlistActivityAttributes.ContentState(
            status:       entry.status,
            minutesLeft:  0,
            partiesAhead: 0,
            progress:     1.0
        )
        await activity?.end(using: finalState, dismissalPolicy: .after(.now + 30))
        activity = nil
    }

    // ── Primitive variant (used by App Clip) ──────────────────────────────

    func start(entryId: String, name: String?, partySize: Int,
               minutesLeft: Int, partiesAhead: Int, progress: Double,
               restaurantName: String = "HOST") async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attrs = WaitlistActivityAttributes(
            entryId:    entryId,
            name:       name ?? "Guest",
            partySize:  partySize,
            restaurant: restaurantName
        )
        let state = WaitlistActivityAttributes.ContentState(
            status:       "waiting",
            minutesLeft:  minutesLeft,
            partiesAhead: partiesAhead,
            progress:     progress
        )
        activity = try? Activity.request(
            attributes: attrs,
            contentState: state,
            pushType: nil
        )
    }

    func update(status: String, minutesLeft: Int, partiesAhead: Int, progress: Double) async {
        let state = WaitlistActivityAttributes.ContentState(
            status:       status,
            minutesLeft:  minutesLeft,
            partiesAhead: partiesAhead,
            progress:     progress
        )
        await activity?.update(using: state)
    }

    func end() async {
        let finalState = WaitlistActivityAttributes.ContentState(
            status: "seated", minutesLeft: 0, partiesAhead: 0, progress: 1.0
        )
        await activity?.end(using: finalState, dismissalPolicy: .after(.now + 30))
        activity = nil
    }
}
