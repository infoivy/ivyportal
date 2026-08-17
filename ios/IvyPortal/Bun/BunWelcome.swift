import SwiftUI

/// Founder-directed onboarding (2026-08-17): frame-by-frame adaptation of the
/// reference recording. Cold open on a dark splash with the medallion and a
/// caption, the background warms into a mauve haze while the logo floats to
/// the upper third, then the welcome stack fades in. From there: pitch pages,
/// "What's your name?", "Create your account", and the all-set screen. Bun is
/// a paid product, so account creation reads as an application, not a free
/// signup; the workspace unlocks after login.
enum BunOnb {
    // Palette: grey-taupe haze (founder 2026-08-17: "looks a bit purple" ·
    // desaturated toward Mercury's warmer grey).
    static let splashGround = Color(red: 0.078, green: 0.075, blue: 0.114)  // #14131d
    static let formGround = Color(red: 0.067, green: 0.063, blue: 0.094)    // #111018
    static let hazeTop = Color(red: 0.545, green: 0.514, blue: 0.580)
    static let hazeUpper = Color(red: 0.588, green: 0.553, blue: 0.616)
    static let hazeMid = Color(red: 0.373, green: 0.349, blue: 0.388)
    static let hazeLow = Color(red: 0.122, green: 0.114, blue: 0.118)
    static let cardBlack = Color.black.opacity(0.44)
    static let caption = Color(red: 0.80, green: 0.78, blue: 0.84)
}

/// The haze the splash warms into: a slowly DRIFTING mesh, never static
/// (founder-directed). `lit` crossfades it over the dark splash ground.
private struct BunAuroraBackground: View {
    var lit: Bool
    var body: some View {
        ZStack {
            BunOnb.splashGround
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !lit)) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                // Livelier drift: ~7s orbits, wide center swing, and a warm
                // glow that breathes through the upper half.
                let glow = 0.72 + 0.28 * sin(t * 0.9)
                MeshGradient(
                    width: 3, height: 3,
                    points: [
                        [0, 0],
                        [Float(0.50 + 0.20 * sin(t * 0.95)), 0],
                        [1, 0],
                        [0, Float(0.40 + 0.14 * sin(t * 0.80 + 1.3))],
                        [Float(0.50 + 0.26 * sin(t * 0.70 + 2.1)),
                         Float(0.52 + 0.20 * cos(t * 0.88))],
                        [1, Float(0.48 + 0.16 * cos(t * 0.76 + 0.7))],
                        [0, 1],
                        [Float(0.50 + 0.14 * cos(t * 0.84 + 1.9)), 1],
                        [1, 1],
                    ],
                    colors: [
                        BunOnb.hazeUpper.opacity(glow), BunOnb.hazeTop, BunOnb.hazeMid,
                        BunOnb.hazeMid, BunOnb.hazeTop.opacity(0.62 + 0.30 * cos(t * 0.66)), BunOnb.hazeMid,
                        BunOnb.hazeLow, BunOnb.hazeLow, BunOnb.hazeLow,
                    ]
                )
            }
            .opacity(lit ? 1 : 0)
        }
        .ignoresSafeArea()
    }
}


/// Route stack for the flow after the welcome screen.
private enum BunOnbRoute: Hashable {
    case pitch
    case name
    case account
    case allSet
    case login
}

struct BunWelcomeFlow: View {
    @State private var path: [BunOnbRoute] = []
    // Splash choreography (timings read off the 60fps recording).
    @State private var captionVisible = false
    @State private var risen = false          // logo travelled to the upper third
    @State private var welcomeVisible = false
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var auth = AuthStore.shared

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                ZStack(alignment: .top) {
                    BunAuroraBackground(lit: risen)

                    Image("BunLogo").resizable().renderingMode(.template).scaledToFit()
                        .foregroundStyle(.white)
                        .frame(width: 68, height: 68)
                        .position(x: geo.size.width / 2,
                                  y: geo.size.height * (risen ? 0.21 : 0.44))

                    Text("Where your business runs")
                        .font(bunFont(17)).foregroundStyle(BunOnb.caption)
                        .opacity(captionVisible && !risen ? 1 : 0)
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.44 + 66)

                    if welcomeVisible {
                        welcomeStack
                            .frame(maxHeight: .infinity, alignment: .bottom)
                            .transition(.opacity.combined(with: .offset(y: 12)))
                    }
                }
            }
            .task { await runSplash() }
            .navigationDestination(for: BunOnbRoute.self) { route in
                switch route {
                case .pitch: BunPitchView(path: $path)
                case .name: BunNameView(path: $path, firstName: $firstName, lastName: $lastName)
                case .account: BunCreateAccountView(path: $path, firstName: firstName, lastName: lastName)
                case .allSet: BunAllSetView(path: $path)
                case .login: AuthView(store: auth, showsBack: true).toolbar(.hidden, for: .navigationBar)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func runSplash() async {
        guard !captionVisible else { return }
        try? await Task.sleep(for: .milliseconds(150))
        withAnimation(.easeIn(duration: 0.4)) { captionVisible = true }
        try? await Task.sleep(for: .milliseconds(1500))
        withAnimation(.easeInOut(duration: 1.4)) { risen = true }
        try? await Task.sleep(for: .milliseconds(1100))
        withAnimation(.easeOut(duration: 0.5)) { welcomeVisible = true }
    }

    private var welcomeStack: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Learn more about Bun")
                .font(bunFont(19)).foregroundStyle(BunOnb.caption)
                .padding(.bottom, 2)

            welcomeCard(title: "Business",
                        text: "Everything you need to run and track your business on the go.")
            welcomeCard(title: "Team",
                        text: "A smarter way to stay on top of your work and move with your team.")

            Text("Already have an account?")
                .font(bunFont(17)).foregroundStyle(BunOnb.caption)
                .padding(.top, 12)

            Button {
                path.append(.login)
            } label: {
                HStack {
                    Text("Log in").font(bunFont(21, .medium)).foregroundStyle(BunTheme.ink)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(BunTheme.secondary)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: .infinity, minHeight: 64)
                .bunGlassSurface(Capsule(), tint: Color(red: 0.20, green: 0.20, blue: 0.247).opacity(0.85))
            }
            .buttonStyle(BunPressStyle())
            .accessibilityIdentifier("welcome-login")
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private func welcomeCard(title: String, text: String) -> some View {
        Button {
            path.append(.pitch)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(bunFont(24, .medium)).foregroundStyle(BunTheme.ink)
                Text(text).font(bunFont(17)).foregroundStyle(BunOnb.caption)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .bunGlassSurface(RoundedRectangle(cornerRadius: 18, style: .continuous), tint: BunOnb.cardBlack)
        }
        .buttonStyle(BunPressStyle())
    }
}

// MARK: - Pitch pages

private struct BunPitchView: View {
    @Binding var path: [BunOnbRoute]
    @State private var page = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            BunAuroraBackground(lit: true)

            TabView(selection: $page) {
                pageOne.tag(0)
                pageTwo.tag(1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            VStack(spacing: 18) {
                HStack(spacing: 7) {
                    ForEach(0..<2, id: \.self) { i in
                        Circle().fill(i == page ? Color.white : Color.white.opacity(0.35))
                            .frame(width: 7, height: 7)
                    }
                }
                .padding(.horizontal, 14).frame(height: 30)
                .background(Color.black.opacity(0.35), in: Capsule())

                Button {
                    path.append(.name)
                } label: {
                    Text("Get started").font(bunFont(21, .medium)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .background(BunTheme.indigo, in: Capsule())
                }
                .buttonStyle(BunPressStyle())
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top) { topBar }
        .preferredColorScheme(.dark)
    }

    private var topBar: some View {
        HStack {
            Button {
                if path.isEmpty == false { path.removeLast() }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium)).foregroundStyle(BunTheme.ink)
                    .frame(width: 48, height: 48)
                    .bunGlassSurface(Circle(), tint: Color.black.opacity(0.30))
            }
            .buttonStyle(BunPressStyle())
            Spacer()
            Button {
                path.append(.login)
            } label: {
                Text("Log in").font(bunFont(17, .medium)).foregroundStyle(BunTheme.ink)
                    .padding(.horizontal, 20).frame(height: 44)
                    .bunGlassSurface(Capsule(), tint: Color.black.opacity(0.30))
            }
            .buttonStyle(BunPressStyle())
        }
        .padding(.horizontal, 16)
    }

    private var pageOne: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("The future of your business, in your pocket.")
                .font(bunFont(34, .medium)).foregroundStyle(BunTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text("Sales, fulfillment, and money in one place, wherever work takes you.")
                .font(bunFont(20)).foregroundStyle(BunOnb.caption)
                .fixedSize(horizontal: false, vertical: true)
            BunHeroShot()
                .frame(maxHeight: .infinity)
                .padding(.top, 8)
            Spacer(minLength: 120)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    private var pageTwo: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Every rep, every dollar. One subscription.")
                    .font(bunFont(34, .medium)).foregroundStyle(BunTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 6)

                illustratedCard("See the day at a glance",
                                "EODs, sets, and cash land in one feed the moment your team logs them.") {
                    BunPillMomentIllustration()
                }
                illustratedCard("Know your numbers",
                                "Balance, money in, money spent, and payouts computed live from your deals.") {
                    BunGrowthIllustration()
                }
                pitchCard("Collaborate seamlessly",
                          "Setters, closers, coaches, and CSMs share one workspace with the right access for each.")
                pitchCard("Move money without spreadsheets",
                          "Commissions and payout periods calculated for you, ready to confirm.")
                illustratedCard("Know your data is safe",
                                "Your workspace is isolated end to end. Your team sees only your business.") {
                    BunLockIllustration()
                }

                Text("Bun is a paid product. Your subscription starts once your application is approved, and your team joins free under your workspace.")
                    .font(bunFont(13)).foregroundStyle(BunOnb.caption.opacity(0.8))
                    .padding(.top, 14)

                Spacer(minLength: 140)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
        .scrollIndicators(.hidden)
    }

    private func pitchCard(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(bunFont(21, .medium)).foregroundStyle(BunTheme.ink)
            Text(text).font(bunFont(16)).foregroundStyle(BunOnb.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bunGlassSurface(RoundedRectangle(cornerRadius: 16, style: .continuous), tint: BunOnb.cardBlack)
    }

    private func illustratedCard(_ title: String, _ text: String,
                                 @ViewBuilder art: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(bunFont(21, .medium)).foregroundStyle(BunTheme.ink)
            Text(text).font(bunFont(16)).foregroundStyle(BunOnb.caption)
                .fixedSize(horizontal: false, vertical: true)
            art()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bunGlassSurface(RoundedRectangle(cornerRadius: 16, style: .continuous), tint: BunOnb.cardBlack)
    }
}

/// Hero card on pitch page one: a miniature of the Bun home rendered live,
/// standing in for the reference's photographed device.
private struct BunHeroMock: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(BunTheme.field).frame(width: 28, height: 28)
                    .overlay(Text("A").font(bunFont(14, .medium)).foregroundStyle(BunTheme.ink))
                Text("Acme Coaching").font(bunFont(15, .medium)).foregroundStyle(BunTheme.ink)
                Image(systemName: "chevron.down").font(.system(size: 10, weight: .medium))
                    .foregroundStyle(BunTheme.secondary)
                Spacer()
                Circle().fill(BunTheme.field).frame(width: 26, height: 26)
            }
            Text("Bun balance").font(bunFont(14)).foregroundStyle(BunTheme.secondary)
            Text("$201,983").font(bunFont(30, .medium)).foregroundStyle(BunTheme.ink)
                + Text(".64").font(bunFont(17, .medium)).foregroundStyle(BunTheme.secondary)
            chart
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Money in").font(bunFont(13)).foregroundStyle(BunTheme.secondary)
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .medium))
                        Text("$32.5K").font(bunFont(15, .medium))
                    }
                    .foregroundStyle(BunTheme.green)
                }
                Spacer()
                VStack(alignment: .leading, spacing: 3) {
                    Text("Money spent").font(bunFont(13)).foregroundStyle(BunTheme.secondary)
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.down.right").font(.system(size: 12, weight: .medium))
                        Text("−$10K").font(bunFont(15, .medium))
                    }
                    .foregroundStyle(BunTheme.pink)
                }
                Spacer()
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BunTheme.ground, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(BunTheme.hairline, lineWidth: 1))
    }

    private var chart: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let ys: [CGFloat] = [0.72, 0.55, 0.62, 0.40, 0.48, 0.30, 0.38, 0.22, 0.28, 0.12]
            let pts = ys.enumerated().map { CGPoint(x: w * CGFloat($0.offset) / 9, y: h * $0.element) }
            ZStack {
                Path { p in
                    p.move(to: CGPoint(x: 0, y: h))
                    for pt in pts { p.addLine(to: pt) }
                    p.addLine(to: CGPoint(x: w, y: h))
                    p.closeSubpath()
                }
                .fill(LinearGradient(colors: [BunTheme.chartLine.opacity(0.28), .clear],
                                     startPoint: .top, endPoint: .bottom))
                Path { p in
                    p.move(to: pts[0])
                    for pt in pts.dropFirst() { p.addLine(to: pt) }
                }
                .stroke(BunTheme.chartLine, lineWidth: 1.6)
            }
        }
        .frame(height: 74)
    }
}

/// Framed phone on a soft backdrop: the pitch hero (stands in for the
/// reference's photographed hand).
private struct BunHeroShot: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [Color(red: 0.36, green: 0.38, blue: 0.44),
                                              Color(red: 0.18, green: 0.19, blue: 0.24)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(
                    RadialGradient(colors: [Color.white.opacity(0.14), .clear],
                                   center: .init(x: 0.7, y: 0.15), startRadius: 0, endRadius: 320)
                )
                .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.10), lineWidth: 1))
            BunHeroMock()
                .frame(width: 262)
                .padding(.horizontal, 8)
                .padding(.vertical, 12)
                .background(Color.black, in: RoundedRectangle(cornerRadius: 34, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.22), lineWidth: 2))
                .rotationEffect(.degrees(-2.5))
                .shadow(color: .black.opacity(0.45), radius: 26, y: 16)
                .padding(.vertical, 26)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

/// Light "moment" illustration: the EOD confirmation pill on a bright card
/// (the reference's uploading-receipts treatment).
private struct BunPillMomentIllustration: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(LinearGradient(colors: [Color(red: 0.93, green: 0.92, blue: 0.90),
                                              Color(red: 0.86, green: 0.85, blue: 0.84)],
                                     startPoint: .top, endPoint: .bottom))
            HStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(BunTheme.indigo)
                Text("EOD filed")
                    .font(bunFont(19, .medium)).foregroundStyle(Color(red: 0.20, green: 0.20, blue: 0.24))
                Text("3 of 3")
                    .font(bunFont(17)).foregroundStyle(Color(red: 0.55, green: 0.55, blue: 0.58))
            }
            .padding(.horizontal, 26).frame(height: 58)
            .background(.white, in: Capsule())
            .shadow(color: .black.opacity(0.10), radius: 14, y: 6)
        }
        .frame(height: 168)
    }
}

/// Ascending-curves illustration with a glowing endpoint (the reference's
/// growth chart card).
private struct BunGrowthIllustration: View {
    var body: some View {
        Canvas { context, size in
            let w = size.width, h = size.height
            // faint vertical grid
            for i in 1..<8 {
                let x = w * CGFloat(i) / 8
                var line = Path()
                line.move(to: CGPoint(x: x, y: 0))
                line.addLine(to: CGPoint(x: x, y: h))
                context.stroke(line, with: .color(.white.opacity(0.05)), lineWidth: 1)
            }
            func curve(_ points: [(CGFloat, CGFloat)]) -> Path {
                var path = Path()
                let scaled = points.map { CGPoint(x: $0.0 * w, y: $0.1 * h) }
                path.move(to: scaled[0])
                for i in 1..<scaled.count {
                    let prev = scaled[i - 1], cur = scaled[i]
                    let mid = CGPoint(x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2)
                    path.addQuadCurve(to: mid, control: prev)
                }
                path.addLine(to: scaled.last!)
                return path
            }
            let main = curve([(0, 0.78), (0.2, 0.72), (0.38, 0.56), (0.55, 0.52), (0.75, 0.34), (1.0, 0.22)])
            let secondary = curve([(0, 0.92), (0.25, 0.88), (0.5, 0.76), (0.75, 0.66), (1.0, 0.52)])
            context.stroke(secondary, with: .color(.white.opacity(0.25)), lineWidth: 1.2)
            context.stroke(main, with: .color(.white.opacity(0.85)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
            // glowing endpoint
            let end = CGPoint(x: w * 0.86, y: h * 0.285)
            for (radius, opacity) in [(22.0, 0.08), (13.0, 0.16), (6.0, 0.4)] {
                context.fill(Path(ellipseIn: CGRect(x: end.x - radius, y: end.y - radius,
                                                    width: radius * 2, height: radius * 2)),
                             with: .color(.white.opacity(opacity)))
            }
            context.fill(Path(ellipseIn: CGRect(x: end.x - 3, y: end.y - 3, width: 6, height: 6)),
                         with: .color(.white))
        }
        .frame(height: 190)
        .background(Color(red: 0.16, green: 0.17, blue: 0.21),
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Concentric-ring padlock illustration for the "data is safe" card.
private struct BunLockIllustration: View {
    var body: some View {
        ZStack {
            ForEach(1..<4) { ring in
                Circle()
                    .stroke(Color.white.opacity(0.10 - Double(ring) * 0.02), lineWidth: 22)
                    .frame(width: CGFloat(ring) * 88, height: CGFloat(ring) * 88)
            }
            Image(systemName: "lock.fill")
                .font(.system(size: 40, weight: .regular))
                .foregroundStyle(Color.white.opacity(0.9))
        }
        .frame(maxWidth: .infinity, minHeight: 250)
        .background(Color(red: 0.10, green: 0.095, blue: 0.125), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Application: name

private struct BunNameView: View {
    @Binding var path: [BunOnbRoute]
    @Binding var firstName: String
    @Binding var lastName: String
    @FocusState private var focused: Field?
    private enum Field { case first, last }

    private var ready: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ZStack {
            BunOnb.formGround.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 26) {
                Text("What's your name?")
                    .font(bunFont(30, .medium)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 10)
                Text("To get started, tell us about yourself. This application should only take a few minutes.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                TextField("", text: $firstName,
                          prompt: Text("First").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                    .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    .textContentType(.givenName)
                    .focused($focused, equals: .first)
                    .submitLabel(.next)
                    .onSubmit { focused = .last }
                    .padding(.top, 10)

                TextField("", text: $lastName,
                          prompt: Text("Last").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                    .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    .textContentType(.familyName)
                    .focused($focused, equals: .last)
                    .submitLabel(.done)

                Text("By tapping Start application you agree to Bun's Terms of Use and Privacy Policy, and to receive product communication about your account.")
                    .font(bunFont(13)).foregroundStyle(BunTheme.tertiary)
                    .padding(.top, 6)

                BunCTA(label: "Start application", enabled: ready, filled: ready) {
                    path.append(.account)
                }

                Spacer()
            }
            .padding(.horizontal, 22)
        }
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top) { formTopBar { path.removeLast() } }
        .onAppear { focused = .first }
        .preferredColorScheme(.dark)
    }
}

private func formTopBar(back: @escaping () -> Void) -> some View {
    HStack {
        Button(action: back) {
            Image(systemName: "chevron.left")
                .font(.system(size: 18, weight: .medium)).foregroundStyle(BunTheme.ink)
                .frame(width: 44, height: 44)
                .background(BunTheme.raised, in: Circle())
        }
        .buttonStyle(BunPressStyle())
        Spacer()
    }
    .padding(.horizontal, 16)
}

// MARK: - Application: account

private struct BunCreateAccountView: View {
    @Binding var path: [BunOnbRoute]
    let firstName: String
    let lastName: String
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var working = false
    @State private var takenAlert = false
    @State private var errorText: String?
    @State private var auth = AuthStore.shared
    @FocusState private var focused: Field?
    private enum Field { case email, password }

    private var passwordOK: Bool { password.count >= 10 }
    private var ready: Bool { email.contains("@") && passwordOK && !working }

    var body: some View {
        ZStack {
            BunOnb.formGround.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 24) {
                Text("Create your account")
                    .font(bunFont(30, .medium)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 10)
                Text("You will use this email and password to log in across devices.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                TextField("", text: $email,
                          prompt: Text("Email").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                    .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focused, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focused = .password }
                    .padding(.top, 10)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Group {
                            if showPassword {
                                TextField("", text: $password,
                                          prompt: Text("Password").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                            } else {
                                SecureField("", text: $password,
                                            prompt: Text("Password").font(bunFont(19)).foregroundStyle(BunTheme.tertiary))
                            }
                        }
                        .font(bunFont(19)).foregroundStyle(BunTheme.ink)
                        .textContentType(.newPassword)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focused, equals: .password)
                        Button { showPassword.toggle() } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 17, weight: .regular))
                                .foregroundStyle(BunTheme.secondary)
                        }
                        .buttonStyle(BunPressStyle())
                    }
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Minimum 10 characters").font(bunFont(14))
                    }
                    .foregroundStyle(passwordOK ? BunTheme.green : BunTheme.tertiary)
                    .animation(.easeInOut(duration: 0.2), value: passwordOK)
                }

                if let errorText {
                    Text(errorText).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                nextButton

                Spacer()
            }
            .padding(.horizontal, 22)
        }
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top) { formTopBar { path.removeLast() } }
        .onAppear { focused = .email }
        .alert("That email is already taken.", isPresented: $takenAlert) {
            Button("OK", role: .cancel) {}
        }
        .preferredColorScheme(.dark)
    }

    private var nextButton: some View {
        Button {
            Task { await submit() }
        } label: {
            Group {
                if working {
                    ProgressView().tint(.white)
                } else {
                    Text("Next").font(bunFont(21, .medium))
                        .foregroundStyle(ready ? .white : BunTheme.secondary)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(ready || working ? AnyShapeStyle(BunTheme.indigo) : AnyShapeStyle(BunTheme.raised),
                        in: Capsule())
            .animation(.easeInOut(duration: 0.2), value: ready)
        }
        .buttonStyle(BunPressStyle())
        .disabled(!ready && !working)
        .accessibilityIdentifier("account-next")
    }

    private func submit() async {
        working = true
        errorText = nil
        let fullName = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        await auth.signUp(email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                          password: password, fullName: fullName)
        working = false
        if auth.isSignedIn || auth.pendingConfirmationEmail != nil {
            path.append(.allSet)
        } else if let message = auth.errorMessage {
            if message.contains("already exists") {
                takenAlert = true
            } else {
                errorText = message
            }
        }
    }
}

// MARK: - All set

private struct BunAllSetView: View {
    @Binding var path: [BunOnbRoute]
    @State private var auth = AuthStore.shared

    var body: some View {
        ZStack {
            BunOnb.formGround.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 22) {
                Text("You're all set up.")
                    .font(bunFont(30, .medium)).foregroundStyle(BunTheme.ink)
                    .padding(.top, 10)
                Text(bodyText)
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer()

                Button {
                    if auth.isSignedIn {
                        // Root swaps to the workspace on its own; nothing to push.
                    } else {
                        path.append(.login)
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.up.forward.square")
                            .font(.system(size: 17, weight: .medium))
                        Text("Continue your application").font(bunFont(21, .medium))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .background(BunTheme.indigo, in: Capsule())
                }
                .buttonStyle(BunPressStyle())
                .padding(.bottom, 10)
            }
            .padding(.horizontal, 22)
        }
        .toolbar(.hidden, for: .navigationBar)
        .preferredColorScheme(.dark)
    }

    private var bodyText: String {
        if let pending = auth.pendingConfirmationEmail {
            return "Your account is created. Tap the confirmation link we sent to \(pending), then log in to continue your application. Your business workspace unlocks right after."
        }
        return "Your account is created and ready. Continue your application to name your business and unlock your workspace."
    }
}

/// Brief branded splash for warm launches into the workspace: the medallion
/// breathes in, the caption follows, then the whole thing dissolves into
/// Home (the app-level crossfade handles the reveal).
struct BunLaunchSplash: View {
    @State private var logoIn = false
    @State private var captionIn = false

    var body: some View {
        ZStack {
            BunOnb.splashGround.ignoresSafeArea()
            VStack(spacing: 26) {
                Image("BunLogo").resizable().renderingMode(.template).scaledToFit()
                    .foregroundStyle(.white)
                    .frame(width: 68, height: 68)
                    .opacity(logoIn ? 1 : 0)
                Text("Where your business runs")
                    .font(bunFont(17)).foregroundStyle(BunOnb.caption)
                    .opacity(captionIn ? 1 : 0)
            }
            .offset(y: -40)
        }
        .onAppear {
            withAnimation(.easeIn(duration: 0.55)) { logoIn = true }
            withAnimation(.easeIn(duration: 0.45).delay(0.35)) { captionIn = true }
        }
    }
}
