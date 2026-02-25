import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if session.isSignedIn {
                signedInView
            } else {
                AuthView()
            }
        }
    }

    private var signedInView: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Account")
                    .font(.system(size: 11, weight: .medium)).tracking(4)
                    .textCase(.uppercase).foregroundStyle(Color.white.opacity(0.35))
                Text(session.userName ?? "Guest")
                    .font(.system(size: 36, weight: .light))
            }
            .padding(.horizontal, 32).padding(.top, 60).padding(.bottom, 32)

            Divider().overlay(Color.white.opacity(0.08))

            VStack(spacing: 0) {
                row(label: "Name",  value: session.userName  ?? "—")
                row(label: "Phone", value: session.userPhone ?? "—")
            }
            .padding(.top, 8)

            Spacer()

            Button("Sign Out") { session.signOut() }
                .font(.system(size: 13, weight: .medium)).tracking(3).textCase(.uppercase)
                .foregroundStyle(Color.white.opacity(0.35))
                .frame(maxWidth: .infinity).padding(.vertical, 18)
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.white.opacity(0.1)))
                .padding(.horizontal, 32).padding(.bottom, 48)
        }
    }

    private func row(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13)).foregroundStyle(Color.white.opacity(0.4))
            Spacer()
            Text(value)
                .font(.system(size: 13)).foregroundStyle(Color.white.opacity(0.7))
        }
        .padding(.horizontal, 32).padding(.vertical, 20)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1).padding(.horizontal, 32)
        }
    }
}
