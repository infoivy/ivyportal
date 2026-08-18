import SwiftUI

// The daily surfaces that were still web-only (founder 2026-08-18): the
// testimonial library, the schedule with a log-a-set, the knowledge shelf,
// and team administration. Each opens from the tab that already owns that
// work rather than adding another root tab. The team channel is here too but
// OFF unless an org owner turns it on (founder 2026-08-18: Ivy does not use
// it, another business might).

// MARK: - Testimonials

struct BunTestimonialsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var filter = 0
    @State private var writeError: String?

    private static let filters = ["All", "Requested", "Received", "Published"]
    private static let flow = ["requested", "received", "approved", "published"]

    private var rows: [PortalAPI.TestimonialRow] {
        let all = (store.testimonials ?? []).sorted { $0.createdAt > $1.createdAt }
        return switch filter {
        case 1: all.filter { $0.status == "requested" }
        case 2: all.filter { $0.status == "received" }
        case 3: all.filter { $0.status == "published" || $0.status == "approved" }
        default: all
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    BunTitle(text: "Testimonials")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                Text("Proof, from asked to published. Video and image uploads stay on the web.")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                BunSegment(options: Self.filters, selection: $filter)

                if let writeError {
                    Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                if store.testimonials == nil {
                    RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 70)
                } else if rows.isEmpty {
                    Text("Nothing in this state right now.")
                        .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(rows) { row in
                            testimonialRow(row)
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadTestimonials() }
    }

    private func testimonialRow(_ row: PortalAPI.TestimonialRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Text(row.students?.fullName ?? "Client")
                    .font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                BunTag(text: row.type.capitalized)
                Spacer()
                BunTag(text: row.status.capitalized,
                       tint: Self.tint(row.status),
                       fill: Self.tint(row.status).opacity(0.14))
            }
            if let text = row.contentText, !text.isEmpty {
                Text(text).font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            // The next step in the pipeline, one tap, no dropdown to hunt in.
            if let next = Self.nextStatus(row.status) {
                BunPillChip(symbol: "arrow.right", label: "Mark \(next)") {
                    Task {
                        do { try await store.setTestimonialStatus(row, status: next); writeError = nil }
                        catch { writeError = "Could not update: \(error.localizedDescription)" }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
    }

    private static func nextStatus(_ status: String) -> String? {
        guard let index = flow.firstIndex(of: status), index + 1 < flow.count else { return nil }
        return flow[index + 1]
    }

    private static func tint(_ status: String) -> Color {
        switch status {
        case "published": BunTheme.green
        case "approved": Color(red: 0.28, green: 0.75, blue: 0.70)
        case "received": BunTheme.indigoLight
        default: Color(red: 0.95, green: 0.72, blue: 0.35)
        }
    }
}

// MARK: - Team channel

struct BunChatSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var draft = ""
    @State private var kind = 0
    @State private var sendError: String?

    private static let kinds = ["General", "Issue", "Tip", "Bug"]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                BunTitle(text: "Team")
                Spacer()
                BunChipButton(symbol: "xmark") { dismiss() }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 12)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if store.chat == nil {
                            RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 60)
                        } else if (store.chat ?? []).isEmpty {
                            Text("Nothing said yet. History stays forever.")
                                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
                        } else {
                            ForEach(store.chat ?? []) { message in
                                messageRow(message).id(message.id)
                            }
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 12)
                }
                .scrollIndicators(.hidden)
                .onChange(of: (store.chat ?? []).count) { _, _ in
                    // New messages land at the bottom; follow them.
                    if let last = (store.chat ?? []).last { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }

            composer
        }
        .task { await store.loadChat() }
    }

    private func messageRow(_ message: PortalAPI.ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(message.author).font(BunType.caption).foregroundStyle(BunTheme.ink)
                if message.kind != "general" {
                    BunTag(text: message.kind.capitalized,
                           tint: message.kind == "issue" || message.kind == "bug" ? BunTheme.pink : BunTheme.indigoLight,
                           fill: (message.kind == "issue" || message.kind == "bug" ? BunTheme.pink : BunTheme.indigoLight).opacity(0.14))
                }
                if let client = message.studentName {
                    BunTag(text: client)
                }
                Spacer()
                Text(PortalAPI.parseTimestamp(message.createdAt).map { BunStore.friendlyDay($0) } ?? "")
                    .font(BunType.caption).foregroundStyle(BunTheme.tertiary)
            }
            Text(message.body).font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let sendError {
                Text(sendError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
            }
            BunSegment(options: Self.kinds, selection: $kind)
            HStack(spacing: 10) {
                TextField("", text: $draft,
                          prompt: Text("Say something").font(bunFont(18)).foregroundStyle(BunTheme.tertiary),
                          axis: .vertical)
                    .font(bunFont(18)).foregroundStyle(BunTheme.ink)
                    .lineLimit(1...4)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                Button {
                    let body = draft
                    let channel = Self.kinds[kind].lowercased()
                    draft = ""
                    Task {
                        do { try await store.post(body, kind: channel); sendError = nil }
                        catch { sendError = "Could not send: \(error.localizedDescription)" }
                    }
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 17, weight: .medium)).foregroundStyle(.white)
                        .frame(width: 46, height: 46)
                        .background(BunTheme.indigo, in: Circle())
                }
                .buttonStyle(BunPressStyle())
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(draft.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(BunTheme.ground)
    }
}

// MARK: - Knowledge

/// Docs written in Bun on the web, plus the playbooks bundled with the app so
/// a setter on a call has them without a connection.
struct BunKnowledgeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var openDoc: PortalAPI.Doc?
    @State private var openSOP: BunSOP?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunTitle(text: "Knowledge")
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("PLAYBOOKS").font(bunFont(13, .medium)).tracking(0.8)
                        .foregroundStyle(BunTheme.secondary)
                    ForEach(BunSOP.bundled) { sop in
                        Button { openSOP = sop } label: {
                            shelfRow(symbol: sop.symbol, title: sop.title, caption: sop.caption)
                        }
                        .buttonStyle(BunPressStyle())
                    }
                }

                let docs = store.docs ?? []
                if !docs.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("DOCS").font(bunFont(13, .medium)).tracking(0.8)
                            .foregroundStyle(BunTheme.secondary)
                        ForEach(docs) { doc in
                            Button { openDoc = doc } label: {
                                shelfRow(symbol: "doc.text", title: doc.title,
                                         caption: doc.category.capitalized)
                            }
                            .buttonStyle(BunPressStyle())
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .sheet(item: $openSOP) { sop in
            BunReaderSheet(title: sop.title, text: sop.text)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(item: $openDoc) { doc in
            BunReaderSheet(title: doc.title, text: doc.content)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task { await store.loadDocs() }
    }

    private func shelfRow(symbol: String, title: String, caption: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .regular)).foregroundStyle(BunTheme.ink)
                .frame(width: 44, height: 44)
                .background(BunTheme.field, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                if !caption.isEmpty {
                    Text(caption).font(BunType.caption).foregroundStyle(BunTheme.secondary).lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .regular)).foregroundStyle(BunTheme.secondary)
        }
        .frame(minHeight: 62)
        .contentShape(Rectangle())
    }
}

/// A playbook shipped inside the app bundle.
struct BunSOP: Identifiable, Sendable {
    let id: String
    let title: String
    let caption: String
    let symbol: String

    var text: String {
        guard let url = Bundle.main.url(forResource: id, withExtension: "md", subdirectory: "SOPs")
                ?? Bundle.main.url(forResource: id, withExtension: "md"),
              let contents = try? String(contentsOf: url, encoding: .utf8) else {
            return "This playbook could not be opened."
        }
        return contents
    }

    static let bundled: [BunSOP] = [
        .init(id: "isa-setting-process", title: "Setting process",
              caption: "the whole system, start to handoff", symbol: "list.number"),
        .init(id: "simple-discovery-framework-phone-setters", title: "Simple discovery",
              caption: "opening, intent, situation, gap", symbol: "bubble.left.and.bubble.right"),
        .init(id: "objection-handling-playbook", title: "Objection playbook",
              caption: "every objection and its path", symbol: "shield"),
        .init(id: "objection-think-about-it", title: "Think about it",
              caption: "the number-one smokescreen", symbol: "brain"),
        .init(id: "world-class-client-delivery-systems", title: "Client delivery",
              caption: "how delivery is run", symbol: "star"),
        .init(id: "policy-eod-hygiene", title: "EOD and meetings policy",
              caption: "the daily standard", symbol: "checkmark.seal"),
        .init(id: "policy-crm-hygiene", title: "CRM hygiene policy",
              caption: "how the pipeline is kept honest", symbol: "tray.full"),
    ]
}

/// Plain markdown reader: headings promoted, everything else as paragraphs.
struct BunReaderSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    /// Named `text`, not `body`: a stored `body` would collide with View's.
    let text: String

    private var blocks: [(id: Int, text: String, heading: Bool)] {
        text.components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .enumerated()
            .map { index, line in
                let heading = line.hasPrefix("#")
                let clean = line.replacingOccurrences(of: "^#+\\s*", with: "", options: .regularExpression)
                    .replacingOccurrences(of: "**", with: "")
                return (id: index, text: clean, heading: heading)
            }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Spacer()
                    BunChipButton(symbol: "xmark") { dismiss() }
                }
                BunTitle(text: title)
                ForEach(blocks, id: \.id) { block in
                    Text(block.text)
                        .font(block.heading ? bunFont(20, .medium) : bunFont(17))
                        .foregroundStyle(block.heading ? BunTheme.ink : BunTheme.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, block.heading ? 10 : 0)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }
}

// MARK: - Team administration

/// Roles, EOD exemption, and the people waiting to be let in. The heavier
/// admin (deleting accounts, access defaults, commission rates) stays on the
/// web; this is what gets done from a phone.
struct BunTeamAdminScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var approving: PortalAPI.PendingSignup?
    @State private var writeError: String?

    private static let grantable = ["setter", "closer", "csm", "coach", "student"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                BunTitle(text: "Team")

                if let writeError {
                    Text(writeError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                let requests = store.pendingRequests ?? []
                if !requests.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("WAITING").font(bunFont(13, .medium)).tracking(0.8)
                            .foregroundStyle(BunTheme.secondary)
                        ForEach(requests) { request in
                            HStack(spacing: 14) {
                                BunAvatar(text: String((request.displayName ?? "?").prefix(1)), size: 44,
                                          fill: BunStore.fill(for: request.displayName ?? "?"))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(request.displayName ?? "New account")
                                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                                    Text("asked to join \(PortalAPI.parseTimestamp(request.createdAt).map { BunStore.friendlyDay($0).lowercased() } ?? "recently")")
                                        .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                                }
                                Spacer()
                                Menu {
                                    ForEach(Self.grantable, id: \.self) { role in
                                        Button(role.capitalized) { approve(request, role: role) }
                                    }
                                } label: {
                                    Text("Let in").font(bunFont(15, .medium)).foregroundStyle(.white)
                                        .padding(.horizontal, 14).frame(height: 38)
                                        .background(BunTheme.indigo, in: Capsule())
                                }
                            }
                            .frame(minHeight: 66)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("MEMBERS").font(bunFont(13, .medium)).tracking(0.8)
                        .foregroundStyle(BunTheme.secondary)
                    if store.adminProfiles == nil {
                        RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 60)
                    } else {
                        ForEach(store.adminProfiles ?? []) { member in
                            memberRow(member)
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task { await store.loadTeamAdmin() }
    }

    private func memberRow(_ member: StaffProfile) -> some View {
        let roles = store.adminRoles[member.id] ?? []
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 14) {
                BunAvatar(text: String((member.displayName ?? "?").prefix(1)), size: 44,
                          fill: BunStore.fill(for: member.displayName ?? "?"))
                VStack(alignment: .leading, spacing: 3) {
                    Text(member.displayName ?? "Team member")
                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink).lineLimit(1)
                    Text(roles.isEmpty ? "no role yet" : roles.map(\.capitalized).joined(separator: " · "))
                        .font(BunType.caption).foregroundStyle(BunTheme.secondary).lineLimit(1)
                }
                Spacer()
            }
            // Exempt removes them from every expected-filer surface, so it is
            // labelled as the consequence rather than as a switch name.
            Toggle(isOn: Binding(
                get: { store.isExempt(member) },
                set: { value in
                    Task {
                        do { try await store.setExempt(member, exempt: value); writeError = nil }
                        catch { writeError = "Could not save: \(error.localizedDescription)" }
                    }
                }
            )) {
                Text("Files no EOD").font(BunType.caption).foregroundStyle(BunTheme.secondary)
            }
            .tint(BunTheme.indigo)
        }
        .padding(.vertical, 10)
    }

    private func approve(_ request: PortalAPI.PendingSignup, role: String) {
        Task {
            do { try await store.approve(request, role: role); writeError = nil }
            catch { writeError = "Could not approve: \(error.localizedDescription)" }
        }
    }
}

// MARK: - Profit split

/// The split as a per-org setting (migration 20260818040000). The web carries
/// it as a constant with real names in it; that could never ship to a second
/// business, so here it belongs to the org.
struct BunProfitSplitScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = BunStore.shared
    @State private var rows: [PortalAPI.ProfitShare] = []
    @State private var loaded = false
    @State private var saving = false
    @State private var saveError: String?

    private var total: Double { rows.reduce(0) { $0 + $1.pct } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    BunChipButton(symbol: "chevron.left") { dismiss() }
                    Spacer()
                }
                BunTitle(text: "Profit split")
                Text("Shares of profit after expenses and everything the team is owed. This belongs to \(store.orgName).")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(rows.indices, id: \.self) { index in
                    HStack(spacing: 12) {
                        TextField("", text: Binding(
                            get: { rows[index].name },
                            set: { rows[index].name = $0 }
                        ), prompt: Text("Name").font(bunFont(18)).foregroundStyle(BunTheme.tertiary))
                            .font(bunFont(18)).foregroundStyle(BunTheme.ink)
                            .padding(.horizontal, 16).frame(height: 54)
                            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        TextField("", text: Binding(
                            get: { rows[index].pct == 0 ? "" : String(Int(rows[index].pct)) },
                            set: { rows[index].pct = Double($0) ?? 0 }
                        ), prompt: Text("%").font(bunFont(18)).foregroundStyle(BunTheme.tertiary))
                            .font(bunFont(18)).foregroundStyle(BunTheme.ink)
                            .keyboardType(.numberPad)
                            .padding(.horizontal, 16).frame(width: 92, height: 54)
                            .background(BunTheme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        Button {
                            rows.remove(at: index)
                        } label: {
                            Image(systemName: "minus")
                                .font(.system(size: 15, weight: .regular)).foregroundStyle(BunTheme.secondary)
                                .frame(width: 40, height: 40)
                        }
                        .buttonStyle(BunPressStyle())
                    }
                }

                HStack {
                    BunPillChip(symbol: "plus", label: "Add a share") {
                        rows.append(PortalAPI.ProfitShare(name: "", pct: 0))
                    }
                    Spacer()
                    Text("\(Int(total))% allocated")
                        .font(BunType.caption)
                        .foregroundStyle(total > 100 ? BunTheme.pink : BunTheme.secondary)
                }

                if total > 100 {
                    Text("That is more than the profit. Bring it back to 100% or less.")
                        .font(BunType.caption).foregroundStyle(BunTheme.pink)
                }
                if let saveError {
                    Text(saveError).font(bunFont(15)).foregroundStyle(BunTheme.pink)
                }

                BunCTA(label: saving ? "Saving…" : "Save split",
                       enabled: total <= 100 && !saving && rows.allSatisfy { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty },
                       filled: true) {
                    saving = true
                    let clean = rows.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
                    Task {
                        do {
                            try await store.saveProfitSplit(clean)
                            saving = false
                            saveError = nil
                            dismiss()
                        } catch {
                            saving = false
                            saveError = "Could not save: \(error.localizedDescription)"
                        }
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 14)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .task {
            guard !loaded else { return }
            await store.loadOrgs()
            rows = store.profitSplit
            loaded = true
        }
    }
}
