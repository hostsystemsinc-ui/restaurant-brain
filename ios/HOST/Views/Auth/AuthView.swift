import SwiftUI

struct AuthView: View {
    @EnvironmentObject var session: SessionStore
    @State private var isSignUp = false
    @State private var email    = ""
    @State private var password = ""
    @State private var name     = ""
    @State private var loading  = false
    @State private var error    = ""

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {

                VStack(alignment: .leading, spacing: 8) {
                    Text(isSignUp ? "Create account" : "Sign in")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(4).textCase(.uppercase)
                        .foregroundStyle(Color.white.opacity(0.35))
                    Text("HOST")
                        .font(.system(size: 48, weight: .bold))
                        .tracking(10)
                }
                .padding(.horizontal, 32)
                .padding(.top, 72)
                .padding(.bottom, 40)

                Divider().overlay(Color.white.opacity(0.08))

                VStack(alignment: .leading, spacing: 32) {
                    if isSignUp {
                        FieldRow(label: "Name", placeholder: "Your name",
                                 text: $name, contentType: .name)
                    }
                    FieldRow(label: "Email", placeholder: "you@example.com",
                             text: $email, contentType: .emailAddress, keyboard: .emailAddress)
                    FieldRow(label: "Password", placeholder: "••••••••",
                             text: $password, contentType: isSignUp ? .newPassword : .password,
                             secure: true)
                }
                .padding(.horizontal, 32)
                .padding(.top, 36)

                Spacer()

                VStack(spacing: 16) {
                    if !error.isEmpty {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.red.opacity(0.8))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        Group {
                            if loading { ProgressView().tint(.black) }
                            else {
                                Text(isSignUp ? "Create Account" : "Sign In")
                                    .font(.system(size: 15, weight: .semibold))
                                    .tracking(3).textCase(.uppercase)
                            }
                        }
                        .frame(maxWidth: .infinity).frame(height: 56)
                        .background(loading ? Color.white.opacity(0.4) : Color.white)
                        .foregroundStyle(Color.black)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .disabled(loading)
                    .padding(.horizontal, 32)

                    Button(isSignUp ? "Already have an account? Sign in" : "New to HOST? Create account") {
                        withAnimation { isSignUp.toggle(); error = "" }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Color.white.opacity(0.35))
                    .padding(.bottom, 48)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func submit() async {
        loading = true; error = ""
        do {
            if isSignUp {
                let user = try await SupabaseManager.shared.signUp(email: email, password: password)
                try await SupabaseManager.shared.upsertProfile(UserProfile(
                    id: user.id.uuidString, name: name, phone: nil, email: email
                ))
            } else {
                _ = try await SupabaseManager.shared.signIn(email: email, password: password)
            }
            await session.checkSession()
        } catch {
            self.error = isSignUp ? "Could not create account." : "Invalid email or password."
        }
        loading = false
    }
}

private struct FieldRow: View {
    let label:       String
    let placeholder: String
    @Binding var text: String
    var contentType: UITextContentType? = nil
    var keyboard:    UIKeyboardType     = .default
    var secure:      Bool               = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .medium))
                .tracking(3)
                .foregroundStyle(Color.white.opacity(0.35))

            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboard)
                }
            }
            .textContentType(contentType)
            .font(.system(size: 16))
            .foregroundStyle(Color.white)
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.white.opacity(0.15)).frame(height: 1)
            }
        }
    }
}
