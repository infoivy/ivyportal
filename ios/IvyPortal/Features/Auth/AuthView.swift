import SwiftUI

/// Bun login (product identity 2026-08-17): the app IS Bun — one account,
/// your business workspace attached to it. Anatomy per the founder's
/// reference: a SOLID brand header (medallion + wordmark + 2FA codes chip)
/// that content scrolls under, bare title in the scroll, fields, forgot
/// password, and a true multicolor Google button.
struct AuthView: View {
    @Bindable var store: AuthStore
    /// Shown when pushed from the onboarding flow (back chip + swipe).
    var showsBack = false
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var creatingAccount = false
    @State private var showTwoFactor = false
    @State private var resetNotice: String?
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        ZStack(alignment: .top) {
            BunTheme.ground.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    BunTitle(text: creatingAccount ? "Create your account" : "Log in")
                        .padding(.top, 74)

                    BunField(label: "Email", placeholder: "you@yourbusiness.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Password").font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        SecureField("", text: $password,
                                    prompt: Text("Your password").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                            .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                            .textContentType(.password)
                            .focused($focusedField, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { Task { await submit() } }
                            .padding(.horizontal, 18).frame(minHeight: 58)
                            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }

                    if !creatingAccount {
                        Button {
                            Task { await forgotPassword() }
                        } label: {
                            Text("Forgot password?").font(bunFont(16)).foregroundStyle(BunTheme.indigoLight)
                        }
                        .buttonStyle(BunPressStyle())
                    }

                    if let resetNotice {
                        Text(resetNotice).font(bunFont(16)).foregroundStyle(BunTheme.green)
                    }
                    if let pending = store.pendingConfirmationEmail {
                        Text("Account created. Tap the confirmation link we sent to \(pending), then log in.")
                            .font(bunFont(16)).foregroundStyle(BunTheme.green)
                    }
                    if let error = store.errorMessage {
                        Text(error).font(bunFont(16)).foregroundStyle(BunTheme.pink)
                    }

                    BunCTA(label: store.isWorking ? (creatingAccount ? "Creating…" : "Logging in…")
                                  : (creatingAccount ? "Create account" : "Log in"),
                           enabled: !store.isWorking && !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty,
                           filled: !email.isEmpty && !password.isEmpty) {
                        Task { await submit() }
                    }
                    .accessibilityIdentifier("auth-submit")
                    Button {
                        withAnimation(.snappy(duration: 0.2)) { creatingAccount.toggle() }
                    } label: {
                        Text(creatingAccount ? "Have an account? Log in" : "New to Bun? Create an account")
                            .font(bunFont(16)).foregroundStyle(BunTheme.indigoLight)
                    }
                    .buttonStyle(BunPressStyle())

                    HStack(spacing: 12) {
                        Rectangle().fill(BunTheme.hairline).frame(height: 1)
                        Text("or").font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                        Rectangle().fill(BunTheme.hairline).frame(height: 1)
                    }

                    Button { Task { focusedField = nil; await store.signInWithGoogle() } } label: {
                        HStack(spacing: 11) {
                            GoogleGMark().frame(width: 20, height: 20)
                            Text("Continue with Google").font(bunFont(19, .medium))
                        }
                        .foregroundStyle(BunTheme.ink)
                        .frame(maxWidth: .infinity, minHeight: 58)
                        .bunGlassSurface(Capsule(), tint: BunTheme.raised)
                    }
                    .buttonStyle(BunPressStyle())
                    .disabled(store.isWorking)

                    Text(creatingAccount
                         ? "You will name your business right after. Invited teammates land in their team's workspace automatically."
                         : "One Bun account. Your business workspace and team ride along with it.")
                        .font(bunFont(15)).foregroundStyle(BunTheme.secondary)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 60)
            }
            .scrollIndicators(.hidden)

            brandHeader
        }
        .sheet(isPresented: $showTwoFactor) {
            BunTwoFactorInfoSheet()
                .presentationDetents([.medium])
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .preferredColorScheme(.dark)
    }

    /// Solid header the content scrolls under, per the reference: mark +
    /// wordmark left, 2FA codes chip right, soft fade below.
    private var brandHeader: some View {
        HStack(spacing: 12) {
            if showsBack {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .medium)).foregroundStyle(BunTheme.ink)
                        .frame(width: 40, height: 40)
                        .background(BunTheme.raised, in: Circle())
                }
                .buttonStyle(BunPressStyle())
                .accessibilityLabel("Back")
            }
            Image("BunLogo").resizable().renderingMode(.template).scaledToFit()
                .foregroundStyle(BunTheme.ink)
                .frame(width: 30, height: 30)
            Text("BUN").font(bunFont(17, .medium)).tracking(4.5).foregroundStyle(BunTheme.ink)
            Spacer()
            Button { showTwoFactor = true } label: {
                Text("2FA codes").font(bunFont(16)).foregroundStyle(BunTheme.ink)
                    .padding(.horizontal, 18).frame(height: 44)
                    .bunGlassSurface(Capsule(), tint: BunTheme.raised)
            }
            .buttonStyle(BunPressStyle())
        }
        .padding(.horizontal, 18)
        .padding(.top, 6)
        .padding(.bottom, 12)
        .background(
            VStack(spacing: 0) {
                BunTheme.ground
                LinearGradient(colors: [BunTheme.ground, BunTheme.ground.opacity(0)],
                               startPoint: .top, endPoint: .bottom)
                    .frame(height: 26)
            }
            .ignoresSafeArea(edges: .top)
        )
    }

    private func submit() async {
        focusedField = nil
        resetNotice = nil
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if creatingAccount {
            await store.signUp(email: trimmed, password: password)
            if store.pendingConfirmationEmail != nil {
                withAnimation(.snappy(duration: 0.2)) { creatingAccount = false }
            }
        } else {
            await store.signIn(email: trimmed, password: password)
        }
    }

    private func forgotPassword() async {
        focusedField = nil
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("@") else {
            resetNotice = nil
            store.setError("Enter your email above first, then tap Forgot password.")
            return
        }
        await store.sendPasswordReset(email: trimmed)
        if store.errorMessage == nil {
            resetNotice = "Password reset sent. Check \(trimmed) for the link."
        }
    }
}

/// The Google "G" drawn to brand geometry: four arc segments and the bar.
struct GoogleGMark: View {
    var body: some View {
        Canvas { context, size in
            let s = min(size.width, size.height)
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = s / 2
            let mid = radius * 0.79
            let lineWidth = radius * 0.42

            func arc(_ from: Double, _ to: Double, _ color: Color) {
                var p = Path()
                p.addArc(center: center, radius: mid,
                         startAngle: .degrees(from), endAngle: .degrees(to), clockwise: false)
                context.stroke(p, with: .color(color),
                               style: StrokeStyle(lineWidth: lineWidth, lineCap: .butt))
            }
            arc(205, 332, Color(red: 0.918, green: 0.263, blue: 0.208))   // red · top
            arc(135, 205, Color(red: 0.984, green: 0.737, blue: 0.020))   // yellow · left
            arc(45, 135, Color(red: 0.204, green: 0.659, blue: 0.325))    // green · bottom
            arc(-13, 45, Color(red: 0.259, green: 0.522, blue: 0.957))    // blue · right
            let barHeight = lineWidth
            context.fill(
                Path(CGRect(x: center.x, y: center.y - barHeight / 2,
                            width: mid + lineWidth / 2, height: barHeight)),
                with: .color(Color(red: 0.259, green: 0.522, blue: 0.957)))
        }
    }
}

/// What the 2FA codes chip opens. Honest state: code entry activates with
/// enrollment; no dead fields.
private struct BunTwoFactorInfoSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Spacer()
                BunChipButton(symbol: "xmark") { dismiss() }
            }
            BunTitle(text: "Two-factor codes")
            Text("When two-factor is on, we ask for your 6-digit authenticator code right after your password. Lost the device? A recovery code works in its place.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text("Turn it on from Settings, Security, Two-Factor once you are logged in.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
    }
}
