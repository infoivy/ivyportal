import SwiftUI

struct AuthView: View {
    @Bindable var store: AuthStore
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Ivy Portal").font(.system(size: 34, weight: .bold)).tracking(-0.6)
                        Text("Team & student portal · one login").font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding(.top, 60)

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .submitLabel(.next)
                            .padding(16)
                            .background(ivySurface, in: RoundedRectangle(cornerRadius: 16))
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .focused($focusedField, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { Task { await signIn() } }
                            .padding(16)
                            .background(ivySurface, in: RoundedRectangle(cornerRadius: 16))
                    }

                    if let error = store.errorMessage {
                        Text(error).font(.subheadline).foregroundStyle(.red)
                    }

                    Button { Task { await signIn() } } label: {
                        HStack(spacing: 8) {
                            if store.isWorking { ProgressView().tint(.black) }
                            Text(store.isWorking ? "Signing in…" : "Sign in")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(.white, in: RoundedRectangle(cornerRadius: 16))
                        .foregroundStyle(.black)
                    }
                    .buttonStyle(PressableButtonStyle())
                    .disabled(store.isWorking || email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)
                    .opacity(email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty ? 0.5 : 1)

                    Text("Same account as portal.ivysalesacademy.com. Your session is stored on this device only.")
                        .font(.caption).foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 24)
            }
        }
    }

    private func signIn() async {
        focusedField = nil
        await store.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
    }
}
