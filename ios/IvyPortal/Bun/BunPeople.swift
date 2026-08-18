import SwiftUI

/// Team tab (founder 2026-08-18): coverage and the written EODs up top, then
/// the setter/closer funnel that used to sit behind the Studio segment.
struct BunTeamPage: View {
    @State private var store = BunStore.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                BunTitle(text: "Team")
                salesSection
                hairline
                BunTeamCoverage()
                hairline
                performanceSection
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .task {
            await store.loadTeam()
            await store.loadPictures()
        }
        .refreshable {
            store.teamSummary = nil
            store.teamRows = nil
            store.teamNotes = nil
            store.sales = nil
            await store.loadTeam()
            await store.loadPictures()
        }
    }

    /// The web's sales picture, minus what the funnel below already answers:
    /// yesterday judged against the targets that applied, this week's booked
    /// sets and show rate off the set records, and the period's closes.
    @ViewBuilder private var salesSection: some View {
        if let sales = store.sales {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 0) {
                    stat("Sets this week", value: "\(sales.setsWeek)",
                         caption: sales.setsToday > 0 ? "\(sales.setsToday) today" : nil)
                    stat("Show rate", value: sales.showRate.map { "\($0)%" } ?? "–",
                         caption: "\(sales.showed) of \(sales.showed + sales.noShows) showed")
                    stat("Closes", value: "\(sales.closesPeriod)",
                         caption: "this period", tone: BunTheme.green)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Yesterday").font(BunType.label).foregroundStyle(BunTheme.secondary)
                    Text(sales.volumeLine)
                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    if !sales.shortYesterday.isEmpty {
                        Text("Short: " + sales.shortYesterday.joined(separator: ", "))
                            .font(BunType.caption).foregroundStyle(BunTheme.pink)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                }
            }
        }
    }

    /// Label, value, caption — one baseline across the row, caption line
    /// always present so the three read as one block.
    private func stat(_ label: String, value: String, caption: String?, tone: Color = BunTheme.ink) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(value).font(bunFont(26, .medium)).foregroundStyle(tone).monospacedDigit()
            Text(caption ?? " ").font(bunFont(13))
                .foregroundStyle(caption == nil ? .clear : BunTheme.tertiary)
                .lineLimit(1).minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Performance

    /// Funnel + per-setter performance (Mochi shape: sets → shows → closes,
    /// with the outreach volume behind each).
    private var performanceSection: some View {
        VStack(alignment: .leading, spacing: 22) {
            funnelRow
            hairline
            Text("Setters").font(BunType.section).foregroundStyle(BunTheme.ink)
            setterRows
            hairline
            Text("Closers").font(BunType.section).foregroundStyle(BunTheme.ink)
            closerRows
        }
    }

    private var rows: [TeamMemberRow] { store.teamRows ?? [] }

    private var funnelRow: some View {
        let sets = rows.reduce(0) { $0 + $1.sets }
        let shows = rows.reduce(0) { $0 + $1.shows }
        let closes = rows.reduce(0) { $0 + $1.closes }
        return VStack(alignment: .leading, spacing: 14) {
            Text("Last 7 days").font(BunType.label).foregroundStyle(BunTheme.secondary)
            // .top, not the default .center: Sets carries no rate caption, so
            // centering made it a line shorter and dropped it below the other
            // two. Stat values share one baseline (founder rule).
            HStack(alignment: .top, spacing: 0) {
                funnelStat(label: "Sets", value: "\(sets)", tone: BunTheme.ink)
                funnelStat(label: "Showed", value: "\(shows)",
                           tone: BunTheme.ink,
                           caption: sets > 0 ? "\(Int((Double(shows) / Double(sets) * 100).rounded()))% show" : nil)
                funnelStat(label: "Closed", value: "\(closes)",
                           tone: BunTheme.green,
                           caption: shows > 0 ? "\(Int((Double(closes) / Double(shows) * 100).rounded()))% close" : nil)
            }
        }
    }

    private func funnelStat(label: String, value: String, tone: Color, caption: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
            Text(value).font(bunFont(28, .medium)).foregroundStyle(tone).monospacedDigit()
            // Reserve the caption line even when empty so the three tiles are
            // the same height and the block reads as one rectangle.
            Text(caption ?? " ")
                .font(bunFont(14))
                .foregroundStyle(caption == nil ? .clear : BunTheme.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var setterRows: some View {
        VStack(spacing: 0) {
            ForEach(rows.filter { $0.role.lowercased() == "setter" }) { row in
                performanceRow(row, primary: "\(row.sets) sets",
                               secondary: volumeLine(row))
            }
        }
    }

    private var closerRows: some View {
        VStack(spacing: 0) {
            ForEach(rows.filter { $0.role.lowercased() == "closer" }) { row in
                performanceRow(row, primary: "\(row.closes) closes",
                               secondary: "\(row.booked) booked · \(row.shows) showed")
            }
        }
    }

    private func volumeLine(_ row: TeamMemberRow) -> String {
        var bits: [String] = []
        if row.dials > 0 { bits.append("\(row.dials) dials") }
        if row.dmsSent > 0 { bits.append("\(row.dmsSent) DMs") }
        bits.append("\(row.shows) showed")
        return bits.joined(separator: " · ")
    }

    private func performanceRow(_ row: TeamMemberRow, primary: String, secondary: String) -> some View {
        HStack(spacing: 14) {
            BunAvatar(text: String(row.name.prefix(1)), size: 44, fill: BunStore.fill(for: row.name))
            VStack(alignment: .leading, spacing: 3) {
                Text(row.name).font(bunFont(19)).foregroundStyle(BunTheme.ink).lineLimit(1)
                Text(secondary).font(bunFont(15)).foregroundStyle(BunTheme.secondary).lineLimit(1)
            }
            Spacer()
            Text(primary).font(bunFont(17, .medium)).foregroundStyle(BunTheme.ink).monospacedDigit()
        }
        .frame(minHeight: 68)
    }

    private func memberLine(_ row: TeamMemberRow) -> String {
        var bits: [String] = [row.role.capitalized]
        if row.sets > 0 { bits.append("\(row.sets) sets") }
        if row.dials > 0 { bits.append("\(row.dials) dials") }
        if row.dmsSent > 0 { bits.append("\(row.dmsSent) DMs") }
        if row.closes > 0 { bits.append("\(row.closes) closes") }
        bits.append("EOD \(row.eodDays)/7")
        return bits.joined(separator: " · ")
    }

    private var hairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1)
            .padding(.horizontal, -22)
    }
}

/// Clients tab (founder 2026-08-18): the client book that used to sit behind
/// the Studio segment. The + logs a close — its only entry point since the
/// Money chips were removed, and the flow starts by picking a client anyway.
struct BunClientsPage: View {
    @State private var store = BunStore.shared
    @State private var selectedStudent: StudentRosterItem?
    @State private var opsError: String?
    @State private var showLogClose = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    BunTitle(text: "Clients")
                    Spacer()
                    BunChipButton(symbol: "plus") { showLogClose = true }
                        .accessibilityLabel("Log a close")
                }
                deliverySection
                hairline
                clientsSection
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .task {
            await store.loadClients()
            await store.loadOps()
            await store.loadPictures()
            await store.loadActionItems()
        }
        .refreshable {
            store.roster = nil
            store.health = nil
            store.callCounts = nil
            store.studentEODs = nil
            store.scheduledCalls = nil
            await store.loadClients()
            await store.loadPictures()
        }
        .sheet(item: $selectedStudent) { student in
            BunClientSheet(student: student)
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showLogClose) {
            BunLogCloseFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
    }


    /// The web's delivery picture, phone-shaped: six numbers, each one a
    /// filter on the roster below rather than a link to a general page.
    private var deliverySection: some View {
        let delivery = store.delivery
        return VStack(alignment: .leading, spacing: 16) {
            Text("Delivery").font(BunType.section).foregroundStyle(BunTheme.ink)
            let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
            LazyVGrid(columns: columns, spacing: 12) {
                tile("Active", value: delivery.active,
                     detail: "\(delivery.newThisWeek) joined this week", filter: .all)
                tile("At risk", value: delivery.atRisk,
                     detail: "\(delivery.watch) more to watch", filter: .atRisk,
                     tone: delivery.atRisk > 0 ? BunTheme.pink : nil)
                tile("Needs a check-in", value: delivery.dueCheckin,
                     detail: "\(delivery.checkedToday) done today", filter: .needsCheckin,
                     tone: delivery.dueCheckin > 0 ? amber : nil)
                tile("Quiet 14 days", value: delivery.quiet14,
                     detail: "\(delivery.filedToday) filed today", filter: .quiet)
                tile("Stuck in onboarding", value: delivery.stuck,
                     detail: "7+ days in Start Here", filter: .onboarding,
                     tone: delivery.stuck > 0 ? amber : nil)
                tile("Testimonial ready", value: delivery.testimonialsReady,
                     detail: "first win, not collected", filter: .testimonial)
            }
            if delivery.callsWeek > 0 || delivery.openItems > 0 {
                Text("\(delivery.callsWeek) 1:1 call\(delivery.callsWeek == 1 ? "" : "s") booked this week · \(delivery.openItems) open item\(delivery.openItems == 1 ? "" : "s")")
                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
            }
        }
    }

    private var amber: Color { Color(red: 0.95, green: 0.72, blue: 0.35) }

    /// Tiles share one height and one value baseline (founder rule), so the
    /// detail line is always rendered even when it is blank.
    private func tile(_ label: String, value: Int, detail: String,
                      filter: BunStore.ClientFilter, tone: Color? = nil) -> some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) {
                store.clientFilter = store.clientFilter == filter ? .all : filter
            }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(label).font(BunType.label).foregroundStyle(BunTheme.secondary)
                    .lineLimit(1).minimumScaleFactor(0.85)
                Text("\(value)").font(bunFont(26, .medium))
                    .foregroundStyle(tone ?? BunTheme.ink).monospacedDigit()
                Text(detail).font(bunFont(13)).foregroundStyle(BunTheme.tertiary)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
            .padding(14)
            .background(store.clientFilter == filter && filter != .all ? BunTheme.fieldBright : BunTheme.raised,
                        in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(BunPressStyle())
    }

    private var clientsSection: some View {
        VStack(alignment: .leading, spacing: 22) {
            // Today's tally removed 2026-08-18 (founder): the Clients tab
            // opens on the work, not on a counter.
            if let opsError {
                Text(opsError).font(BunType.caption).foregroundStyle(BunTheme.pink)
            }
            HStack {
                Text("Needs a check-in").font(BunType.section).foregroundStyle(BunTheme.ink)
                Spacer()
                Text("Coldest first").font(bunFont(15)).foregroundStyle(BunTheme.secondary)
            }
            if store.checkinStamps == nil || store.roster == nil {
                RoundedRectangle(cornerRadius: 12).fill(BunTheme.field).frame(height: 60)
            } else {
                let queue = Array(store.checkinQueue.prefix(5))
                if queue.isEmpty {
                    Text("Roster is warm. Students land here as they cool down.")
                        .font(bunFont(16)).foregroundStyle(BunTheme.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(queue) { student in
                            checkinRow(student)
                        }
                    }
                }
            }
            hairline
            HStack {
                Text(store.clientFilter.label).font(BunType.section).foregroundStyle(BunTheme.ink)
                Spacer()
                if store.clientFilter != .all {
                    BunPillChip(symbol: "xmark", label: "Clear") {
                        withAnimation(.snappy(duration: 0.2)) { store.clientFilter = .all }
                    }
                }
            }
            clientsList
        }
    }

    private func checkinRow(_ student: StudentRosterItem) -> some View {
        let days = store.daysSinceCheckin(student.id)
        let done = store.checkedNow.contains(student.id) || days == 0
        let label = done ? "Checked in today" : (days.map { "\($0)d since last check-in" } ?? "No check-in on record")
        let tone: Color = done ? BunTheme.green : (days == nil || days! >= 4 ? BunTheme.pink : days! >= 2 ? Color(red: 0.95, green: 0.72, blue: 0.35) : BunTheme.secondary)
        return HStack(spacing: 14) {
            BunAvatar(text: String(student.fullName.prefix(1)), size: 44, fill: BunStore.fill(for: student.fullName))
            VStack(alignment: .leading, spacing: 3) {
                Text(student.fullName).font(bunFont(19)).foregroundStyle(BunTheme.ink).lineLimit(1)
                Text(label).font(bunFont(15)).foregroundStyle(tone)
            }
            Spacer()
            Button {
                guard !done else { return }
                Task {
                    do { try await store.quickCheckin(student); opsError = nil }
                    catch { opsError = "Check-in failed: \(error.localizedDescription)" }
                }
            } label: {
                Image(systemName: done ? "checkmark.circle" : "message.badge")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(done ? BunTheme.green : BunTheme.indigoLight)
                    .frame(width: 44, height: 44)
                    .background(BunTheme.field, in: Circle())
            }
            .buttonStyle(BunPressStyle())
            .disabled(done)
            .accessibilityLabel(done ? "\(student.fullName) checked in" : "Check in with \(student.fullName)")
        }
        .frame(minHeight: 64)
    }

    /// Priority-ordered clients (founder rule: struggling 1:1 lead,
    /// scholarship closes the list — ClientPriority, unchanged).
    @ViewBuilder private var clientsList: some View {
        if store.roster == nil {
            ForEach(0..<4, id: \.self) { _ in
                HStack(spacing: 14) {
                    Circle().fill(BunTheme.field).frame(width: 44, height: 44)
                    RoundedRectangle(cornerRadius: 8).fill(BunTheme.field).frame(width: 190, height: 16)
                    Spacer()
                }
                .frame(minHeight: 60)
            }
        } else if store.clients(for: store.clientFilter).isEmpty {
            Text(store.clientFilter == .all
                 ? "No active clients yet. Logged closes create client accounts."
                 : "Nobody is in that state right now.")
                .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
        } else {
            VStack(spacing: 0) {
                ForEach(store.clients(for: store.clientFilter)) { student in
                    BunClientRow(
                        student: student,
                        health: store.health?[student.id],
                        paid: store.paidByStudent?[student.fullName] ?? 0,
                        total: store.totalByStudent?[student.fullName] ?? 0
                    ) { selectedStudent = student }
                }
            }
        }
    }

    private var hairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1)
            .padding(.horizontal, -22)
    }
}
