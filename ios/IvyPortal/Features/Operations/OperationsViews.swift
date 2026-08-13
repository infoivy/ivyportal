import SwiftUI
import Charts

struct DirectoryBackButton: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.largeTitle.bold()).tracking(-0.6).accessibilityAddTraits(.isHeader)
            if !subtitle.isEmpty { Text(subtitle).font(.subheadline.weight(.medium)).foregroundStyle(.secondary) }
        }
    }
}

struct WorkHubView: View {
    @Binding var tab: WorkTab
    let onOpenPulse: (CRMSource) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                DirectoryBackButton(title: "Work", subtitle: "Action items, calendar, CRM, and money")
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(WorkTab.allCases, id: \.self) { option in
                            Button(option.label) { tab = option }
                                .font(.subheadline.bold()).padding(.horizontal, 16).frame(minHeight: 42)
                                .background(tab == option ? Color.white.opacity(0.22) : ivySurface, in: Capsule())
                        }
                    }
                }.scrollIndicators(.hidden)
                switch tab {
                case .actionItems: ActionItemsView()
                case .calendar: CalendarView()
                case .crm: CRMView(onOpenPulse: onOpenPulse)
                case .money: MoneyInView(tab: .constant(.overview))
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
    }
}

struct ActionItemsView: View {
    @State private var realItems: [StudentActionItem]?
    @State private var realLoading = false
    @State private var realError: String?
    #if DEBUG
    @State private var filter = "Open"
    @State private var items = DemoOperations.actions
    #endif

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if signedIn {
                liveContent
            } else {
                #if DEBUG
                fixtureContent
                #else
                StatusCard(symbol: "lock.shield.fill", title: "Connect Action Items", message: "Sign in to load verified assigned and overdue work.")
                #endif
            }
        }
        .task { await loadRealIfNeeded() }
    }

    private func loadRealIfNeeded() async {
        guard signedIn, realItems == nil else { return }
        realLoading = true
        defer { realLoading = false }
        do {
            realItems = try await PortalAPI.shared.openActionItems()
            realError = nil
        } catch {
            realError = "Could not load action items."
        }
    }

    @ViewBuilder private var liveContent: some View {
        if let realItems {
            let open = realItems.filter { !$0.done }
            HStack { Label("\(open.count) open", systemImage: "circle"); Spacer(); Text("\(open.filter { ($0.dueDate ?? "") < Self.todayISO }.count) overdue").foregroundStyle(.orange) }.font(.caption.weight(.semibold))
            if open.isEmpty {
                StatusCard(symbol: "checkmark.circle", title: "All clear", message: "No open action items.")
            } else {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(open.enumerated()), id: \.element.id) { index, item in
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: "circle").foregroundStyle(.orange).font(.title3)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(item.text).font(.headline)
                                    if let due = item.dueDate { Text("Due \(due)").font(.caption2.weight(.semibold)).foregroundStyle(.orange) }
                                }
                                Spacer()
                            }.padding(.vertical, 14).contentShape(Rectangle())
                            if index < open.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 44) }
                        }
                    }
                }
                Text("Source: real student_action_items via your portal session").font(.caption).foregroundStyle(.tertiary)
            }
        } else if realLoading {
            SkeletonCards(count: 3, height: 96)
        } else {
            StatusCard(symbol: "exclamationmark.triangle", title: "Unavailable", message: realError ?? "Sign in to load action items.", retry: { realItems = nil; Task { await loadRealIfNeeded() } })
        }
    }

    private static var todayISO: String {
        let f = ISO8601DateFormatter()
        return f.string(from: Date())
    }

    #if DEBUG
    private var fixtureContent: some View {
        VStack(alignment: .leading, spacing: 22) {
            Picker("Filter", selection: $filter) { ForEach(["Open", "Mine", "Overdue", "All"], id: \.self) { Text($0) } }.pickerStyle(.segmented)
            HStack { Label("\(items.filter { !$0.done }.count) open", systemImage: "circle"); Spacer(); Text("\(items.filter { $0.overdue && !$0.done }.count) overdue").foregroundStyle(.orange) }.font(.caption.weight(.semibold))
            SurfaceCard {
                VStack(spacing: 0) {
                    ForEach(Array(visible.enumerated()), id: \.element.id) { index, item in
                        Button { toggle(item.id) } label: {
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: item.done ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(item.done ? ivyGreen : item.overdue ? .orange : .secondary)
                                    .font(.title3)
                                    .symbolEffect(.bounce, value: item.done)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(item.title).font(.headline).strikethrough(item.done).foregroundStyle(item.done ? .secondary : .primary)
                                    Text("\(item.subject) · \(item.owner)").font(.caption).foregroundStyle(.secondary)
                                    Text(item.due).font(.caption2.weight(.semibold)).foregroundStyle(item.overdue ? .orange : .secondary)
                                }
                                Spacer(); Text(item.source).font(.caption2.bold()).padding(.horizontal, 7).padding(.vertical, 4).background(ivyRaised, in: Capsule())
                            }
                            .padding(.vertical, 14).contentShape(Rectangle())
                        }
                        .buttonStyle(PressableButtonStyle())
                        if index < visible.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 44) }
                    }
                }
            }
            Button { addDemo() } label: {
                Label("Add action item", systemImage: "plus").frame(maxWidth: .infinity, minHeight: 48).background(.white, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.black).fontWeight(.semibold)
            }.buttonStyle(PressableButtonStyle())
            Text("Debug fixture · Tapping animates completion; it does not write to Portal").font(.caption).foregroundStyle(.tertiary)
        }
    }
    #endif

    #if DEBUG
    private var visible: [DemoAction] { items.filter { item in switch filter { case "Mine": item.owner == "You"; case "Overdue": item.overdue && !item.done; case "All": true; default: !item.done } } }
    private func toggle(_ id: UUID) {
        withAnimation(.spring(duration: 0.4, bounce: 0.35)) {
            if let i = items.firstIndex(where: { $0.id == id }) { items[i].done.toggle() }
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    private func addDemo() {
        withAnimation(.spring(duration: 0.4, bounce: 0.3)) {
            items.append(.init(id: UUID(), title: "Send student onboarding follow-up", subject: "Team", owner: "You", due: "Due Friday", source: "Ad-hoc", overdue: false, done: false))
        }
    }
    #endif
}

struct CalendarView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            #if DEBUG
            SurfaceCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("12").font(.system(size: 44, weight: .bold, design: .rounded)).monospacedDigit()
                    Text("August 2026 · Wednesday").foregroundStyle(.secondary)
                    HStack { ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { Text($0).frame(maxWidth: .infinity).font(.caption.bold()).foregroundStyle(.secondary) } }
                    HStack { ForEach(1...7, id: \.self) { day in Text("\(day)").frame(maxWidth: .infinity).font(.subheadline).padding(.vertical, 7).background(day == 12 ? Color.white.opacity(0.22) : .clear, in: Circle()) } }
                }
            }
            Text("UPCOMING").font(.caption.bold()).tracking(1).foregroundStyle(.secondary)
            SurfaceCard {
                VStack(spacing: 0) {
                    CalendarRow(time: "5:00 PM", title: "Founder review", detail: "Weekly performance and actions", color: .blue)
                    Divider().overlay(Color.white.opacity(0.08))
                    CalendarRow(time: "6:30 PM", title: "Yusuf · Coaching call", detail: "Roleplay feedback", color: .red)
                    Divider().overlay(Color.white.opacity(0.08))
                    CalendarRow(time: "8:00 PM", title: "Amina · Progress review", detail: "CSM touchpoint", color: ivyGreen)
                }
            }
            Text("Debug fixture · Calendar reads are local only").font(.caption).foregroundStyle(.tertiary)
            #else
            StatusCard(symbol: "lock.shield.fill", title: "Connect Calendar", message: "Sign in to load verified calls, reviews, and deadlines.")
            #endif
        }
    }
}

struct CRMView: View {
    let onOpenPulse: (CRMSource) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            #if DEBUG
            Text("Two sources. Never merged.").font(.subheadline).foregroundStyle(.secondary)
            CRMChannelCard(title: "Close CRM", detail: "Phone calls, dials, pipeline, shows, and closes", symbol: "phone.fill", color: .blue, source: .close, onOpen: onOpenPulse)
            CRMChannelCard(title: "Mochi", detail: "DMs, replies, links, follow-ups, and booked calls", symbol: "message.fill", color: .purple, source: .mochi, onOpen: onOpenPulse)
            Text("Debug fixture · Deep CRM records open in Pulse with the matching source").font(.caption).foregroundStyle(.tertiary)
            #else
            StatusCard(symbol: "lock.shield.fill", title: "Connect CRM", message: "Sign in to load verified Close phone and Mochi DM records.")
            #endif
        }
    }
}

struct PayoutsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                DirectoryBackButton(title: "Payouts", subtitle: "Setter commissions and payout status")
                #if DEBUG
                HStack(spacing: 12) {
                    DirectoryStat(value: "$8.2K", label: "Period pool")
                    DirectoryStat(value: "$5.9K", label: "Paid out")
                    DirectoryStat(value: "$2.3K", label: "Pending")
                }
                SurfaceCard {
                    VStack(spacing: 0) {
                        PayoutRow(name: "Haroon Quraishi", value: "$1,840", status: "Paid", color: .purple)
                        Divider().overlay(Color.white.opacity(0.08))
                        PayoutRow(name: "Masood Ali", value: "$1,120", status: "Paid", color: .pink)
                        Divider().overlay(Color.white.opacity(0.08))
                        PayoutRow(name: "Aalian Khan", value: "$940", status: "Pending", color: .blue)
                        Divider().overlay(Color.white.opacity(0.08))
                        PayoutRow(name: "Abdelmalik", value: "$610", status: "Pending", color: ivyGreen)
                    }
                }
                Text("Debug fixture · Payout math is illustrative, not live commission data").font(.caption).foregroundStyle(.tertiary)
                #else
                StatusCard(symbol: "lock.shield.fill", title: "Connect Payouts", message: "Sign in to load verified commission and payout records.")
                #endif
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
    }
}

struct FinanceView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                DirectoryBackButton(title: "Finance", subtitle: "Revenue, cash, and collections")
                #if DEBUG
                HStack(spacing: 12) {
                    DirectoryStat(value: "$31K", label: "Applied")
                    DirectoryStat(value: "$12.5K", label: "Received")
                    DirectoryStat(value: "$8.5K", label: "Outstanding")
                }
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Monthly collection").font(.headline)
                        Chart {
                            BarMark(x: .value("Month", "Jun"), y: .value("$", 9200)).foregroundStyle(ivyGreen)
                            BarMark(x: .value("Month", "Jul"), y: .value("$", 11300)).foregroundStyle(ivyGreen)
                            BarMark(x: .value("Month", "Aug"), y: .value("$", 12500)).foregroundStyle(ivyGreen.opacity(0.55))
                        }.frame(height: 150)
                    }
                }
                Text("Debug fixture · Finance mirrors Money In without duplicating setter attribution").font(.caption).foregroundStyle(.tertiary)
                #else
                StatusCard(symbol: "lock.shield.fill", title: "Connect Finance", message: "Sign in to load verified revenue and collection data.")
                #endif
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
    }
}

struct CardsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                DirectoryBackButton(title: "Cards", subtitle: "Portal cards and sponsorship assets")
                #if DEBUG
                SurfaceCard {
                    VStack(spacing: 12) {
                        Label("Sponsorship cards", systemImage: "creditcard.fill").font(.headline)
                        Text("Portal card management is not available in this build. Open the web Portal to manage cards.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity)
                }
                Text("Debug fixture · No production action is performed").font(.caption).foregroundStyle(.tertiary)
                #else
                StatusCard(symbol: "lock.shield.fill", title: "Connect Cards", message: "Portal card management is not available in this build.")
                #endif
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
    }
}

struct TeamChatsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                DirectoryBackButton(title: "Team Chats", subtitle: "Conversations and updates")
                StatusCard(symbol: "bubble.left.and.bubble.right", title: "No team chat configured", message: "You do not have a team chat in Portal yet. Connect one in the web Portal and it will appear here.")
                Text("Shown truthfully instead of inventing conversations").font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
    }
}

struct KnowledgeView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                DirectoryBackButton(title: "Knowledge", subtitle: "SOPs, scripts, and policies")
                #if DEBUG
                SurfaceCard {
                    VStack(spacing: 0) {
                        KnowledgeRow(title: "Setter onboarding SOP", detail: "Day 1 to day 14", color: .blue)
                        Divider().overlay(Color.white.opacity(0.08))
                        KnowledgeRow(title: "Close call script", detail: "Phone qualification flow", color: .purple)
                        Divider().overlay(Color.white.opacity(0.08))
                        KnowledgeRow(title: "Mochi DM playbook", detail: "Outreach and follow-up cadence", color: .pink)
                        Divider().overlay(Color.white.opacity(0.08))
                        KnowledgeRow(title: "Student success policy", detail: "CSM touchpoint standards", color: ivyGreen)
                    }
                }
                Text("Debug fixture · Article content is not bundled in this build").font(.caption).foregroundStyle(.tertiary)
                #else
                StatusCard(symbol: "lock.shield.fill", title: "Connect Knowledge", message: "Sign in to load verified SOPs, scripts, and policies.")
                #endif
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
    }
}

struct MoneyInView: View {
    @Binding var tab: MoneyInTab
    #if DEBUG
    @State private var detail: MoneyDetail?
    #endif

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ScreenHeader(title: "Money In", subtitle: "Applied, received, deals, plans, and setter attribution")
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(MoneyInTab.allCases, id: \.self) { option in
                            Button(option.label) { tab = option }
                                .font(.subheadline.bold()).padding(.horizontal, 16).frame(minHeight: 42)
                                .background(tab == option ? Color.white.opacity(0.22) : ivySurface, in: Capsule())
                        }
                    }
                }.scrollIndicators(.hidden)
                #if DEBUG
                switch tab {
                case .overview: overview
                case .deals: deals
                case .paymentPlans: plans
                case .setters: setters
                }
                Text("Debug fixture · Tap every metric or person for detail").font(.caption).foregroundStyle(.tertiary)
                #else
                StatusCard(symbol: "lock.shield.fill", title: "Connect Money In", message: "Sign in to load verified applied, received, payment-plan, and attribution data.")
                #endif
            }.padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 120)
        }.scrollIndicators(.hidden)
        #if DEBUG
        .sheet(item: $detail) { MoneyDetailSheet(detail: $0) }
        #endif
    }

    #if DEBUG
    private var overview: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                MetricNumberCard(title: "Total applied", value: "$31K", context: "8 applications", symbol: "creditcard.fill", color: .blue) { detail = .applied }
                MetricNumberCard(title: "Total received", value: "$12.5K", context: "Whop net", symbol: "banknote.fill", color: ivyGreen) { detail = .received }
            }
            HStack(spacing: 12) {
                MetricNumberCard(title: "Outstanding", value: "$8.5K", context: "14 active plans", symbol: "clock.fill", color: .orange) { detail = .outstanding }
                MetricNumberCard(title: "Overdue", value: "$1.5K", context: "2 installments", symbol: "exclamationmark.triangle.fill", color: .red) { tab = .paymentPlans }
            }
            section("By setter", detail: "Tap a person")
            setterList
        }
    }

    private var deals: some View {
        VStack(alignment: .leading, spacing: 16) {
            section("Recent deals", detail: "Last 30 days")
            SurfaceCard { VStack(spacing: 0) { ForEach(Array(DemoOperations.deals.enumerated()), id: \.element.id) { index, deal in Button { detail = .deal(deal.name) } label: { MoneyRow(name: deal.name, detail: "\(deal.program) · \(deal.owner)", value: deal.value, color: deal.color) }.buttonStyle(PressableButtonStyle()); if index < DemoOperations.deals.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 52) } } } }
        }
    }

    private var plans: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) { PlanStat(value: "14", label: "Active"); PlanStat(value: "2", label: "Overdue"); PlanStat(value: "$8.5K", label: "Outstanding") }
            section("Payment plans", detail: "Due-date order")
            SurfaceCard { VStack(spacing: 0) { ForEach(Array(DemoOperations.plans.enumerated()), id: \.element.id) { index, plan in Button { detail = .plan(plan.name) } label: { MoneyRow(name: plan.name, detail: plan.due, value: plan.value, color: plan.overdue ? .red : ivyGreen) }.buttonStyle(PressableButtonStyle()); if index < DemoOperations.plans.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 52) } } } }
        }
    }

    private var setters: some View { VStack(alignment: .leading, spacing: 16) { section("Setter attribution", detail: "Applied + received"); setterList } }
    private var setterList: some View { SurfaceCard { VStack(spacing: 0) { ForEach(Array(DemoOperations.setters.enumerated()), id: \.element.id) { index, setter in Button { detail = .setter(setter.name) } label: { HStack(spacing: 12) { Circle().fill(setter.color.opacity(0.2)).frame(width: 42, height: 42).overlay(Text(setter.name.prefix(1)).bold().foregroundStyle(setter.color)); VStack(alignment: .leading, spacing: 4) { Text(setter.name).font(.headline); Text("\(setter.applications) applications · \(setter.deals) deals").font(.caption).foregroundStyle(.secondary) }; Spacer(); VStack(alignment: .trailing, spacing: 4) { Text(setter.received).font(.headline).monospacedDigit(); Text("received").font(.caption2).foregroundStyle(setter.color) }; Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary) }.frame(minHeight: 68).contentShape(Rectangle()) }.buttonStyle(PressableButtonStyle()); if index < DemoOperations.setters.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) } } } } }
    private func section(_ title: String, detail: String) -> some View { HStack { Text(title).font(.title2.bold()); Spacer(); Text(detail).font(.caption).foregroundStyle(.secondary) } }
    #endif
}

#if DEBUG
private struct CalendarRow: View {
    let time, title, detail: String
    let color: Color
    var body: some View {
        HStack(spacing: 14) {
            Text(time).font(.subheadline.bold()).monospacedDigit().frame(width: 64, alignment: .leading).foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline); Text(detail).font(.caption).foregroundStyle(.secondary) }
            Spacer()
            Circle().fill(color).frame(width: 8, height: 8)
        }.frame(minHeight: 64)
    }
}

private struct CRMChannelCard: View {
    let title, detail, symbol: String
    let color: Color
    let source: CRMSource
    let onOpen: (CRMSource) -> Void
    var body: some View {
        Button { onOpen(source) } label: {
            HStack(spacing: 14) {
                Image(systemName: symbol).foregroundStyle(color).frame(width: 46, height: 46).background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 5) {
                    Text(title).font(.headline)
                    Text(detail).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                }
                Spacer()
                Text("Open").font(.subheadline.bold()).foregroundStyle(color)
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }.padding(16).background(ivySurface, in: RoundedRectangle(cornerRadius: 20))
        }.buttonStyle(PressableButtonStyle())
    }
}

private struct PayoutRow: View {
    let name, value, status: String
    let color: Color
    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(color.opacity(0.2)).frame(width: 40, height: 40).overlay(Text(name.prefix(1)).bold().foregroundStyle(color))
            Text(name).font(.headline)
            Spacer()
            Text(value).font(.headline).monospacedDigit()
            Text(status).font(.caption2.bold()).padding(.horizontal, 8).padding(.vertical, 4).background(status == "Paid" ? ivyGreen.opacity(0.15) : Color.orange.opacity(0.15), in: Capsule()).foregroundStyle(status == "Paid" ? ivyGreen : .orange)
        }.frame(minHeight: 64)
    }
}

private struct KnowledgeRow: View {
    let title, detail: String
    let color: Color
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "doc.text.fill").foregroundStyle(color).frame(width: 34)
            VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline); Text(detail).font(.caption).foregroundStyle(.secondary) }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
        }.frame(minHeight: 62)
    }
}

private struct DirectoryStat: View {
    let value, label: String
    var body: some View {
        SurfaceCard(padding: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text(value).font(.headline).monospacedDigit()
                Text(label).font(.caption2).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct MoneyRow: View { let name, detail, value: String; let color: Color; var body: some View { HStack(spacing: 12) { Circle().fill(color.opacity(0.2)).frame(width: 40, height: 40).overlay(Text(name.prefix(1)).bold().foregroundStyle(color)); VStack(alignment: .leading, spacing: 4) { Text(name).font(.headline); Text(detail).font(.caption).foregroundStyle(.secondary) }; Spacer(); Text(value).font(.headline).monospacedDigit(); Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary) }.frame(minHeight: 66).contentShape(Rectangle()) } }
private struct PlanStat: View { let value, label: String; var body: some View { SurfaceCard(padding: 14) { VStack(alignment: .leading, spacing: 5) { Text(value).font(.headline).monospacedDigit(); Text(label).font(.caption2).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading) } } }
private enum MoneyDetail: Identifiable { case applied, received, outstanding, setter(String), deal(String), plan(String); var id: String { switch self { case .applied: "applied"; case .received: "received"; case .outstanding: "outstanding"; case let .setter(v): "setter-\(v)"; case let .deal(v): "deal-\(v)"; case let .plan(v): "plan-\(v)" } }; var title: String { switch self { case .applied: "Total applied"; case .received: "Total received"; case .outstanding: "Outstanding"; case let .setter(v), let .deal(v), let .plan(v): v } } }
private struct MoneyDetailSheet: View { @Environment(\.dismiss) private var dismiss; let detail: MoneyDetail; var body: some View { ScrollView { VStack(alignment: .leading, spacing: 24) { HStack { Text(detail.title).font(.title2.bold()); Spacer(); Button("Done") { dismiss() } }; HStack(spacing: 12) { PlanStat(value: "$12.5K", label: "Received"); PlanStat(value: "$31K", label: "Applied"); PlanStat(value: "40%", label: "Collection") }; Text("BREAKDOWN").font(.caption.bold()).tracking(1).foregroundStyle(.secondary); SurfaceCard { VStack(spacing: 14) { MoneyRow(name: "Whop", detail: "Verified provider", value: "$9.5K", color: ivyGreen); Divider(); MoneyRow(name: "Bank", detail: "Manual match", value: "$3K", color: .blue) } }; Text("Debug fixture · Production data requires authenticated Portal APIs").font(.caption).foregroundStyle(.tertiary) }.padding(24) } .presentationDetents([.large]).presentationBackground(ivySurface) } }
struct DemoAction: Identifiable { let id: UUID; let title, subject, owner, due, source: String; let overdue: Bool; var done: Bool }
struct DemoDeal: Identifiable { let id = UUID(); let name, program, owner, value: String; let color: Color }
struct DemoPlan: Identifiable { let id = UUID(); let name, due, value: String; let overdue: Bool }
struct DemoSetter: Identifiable { let id = UUID(); let name, applications, deals, received: String; let color: Color }
enum DemoOperations {
    static let actions = [DemoAction(id: UUID(), title: "Send updated onboarding plan", subject: "Amina H.", owner: "You", due: "Overdue · yesterday", source: "Ad-hoc", overdue: true, done: false), DemoAction(id: UUID(), title: "Review roleplay recording", subject: "Yusuf K.", owner: "You", due: "Overdue · Monday", source: "1:1 call", overdue: true, done: false), DemoAction(id: UUID(), title: "Confirm next coaching call", subject: "Maryam A.", owner: "Sara", due: "Due today", source: "Ad-hoc", overdue: false, done: false)]
    static let deals = [DemoDeal(name: "Amina H.", program: "1:1 Pathway", owner: "Haroon", value: "$5,000", color: .purple), DemoDeal(name: "Yusuf K.", program: "Group Expertise", owner: "Masood", value: "$2,500", color: .pink), DemoDeal(name: "Maryam A.", program: "1:1 Pathway", owner: "Aalian", value: "$5,000", color: .blue)]
    static let plans = [DemoPlan(name: "Yusuf K.", due: "Due Aug 10 · overdue", value: "$750", overdue: true), DemoPlan(name: "Bilal R.", due: "Due Aug 14", value: "$500", overdue: false), DemoPlan(name: "Maryam A.", due: "Due Sep 1", value: "$1,250", overdue: false)]
    static let setters = [DemoSetter(name: "Haroon Quraishi", applications: "18", deals: "4", received: "$5.8K", color: .purple), DemoSetter(name: "Masood Ali", applications: "11", deals: "2", received: "$3.2K", color: .pink), DemoSetter(name: "Aalian Khan", applications: "9", deals: "2", received: "$2.1K", color: .blue), DemoSetter(name: "Abdelmalik", applications: "6", deals: "1", received: "$1.4K", color: ivyGreen)]
    static let dailyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    static let dailyValues = [78, 92, 84, 103, 96, 88, 60]
    static let hourlyLabels = ["6a", "9a", "12p", "3p", "6p", "9p"]
    static let hourlyValues = [12, 54, 71, 64, 78, 46]
    static let eods = [
        DemoEOD(name: "Haroon Quraishi", color: .purple, status: .submitted, line: "Submitted · 8:02 PM", content: "104 dials, 12 connects, 3 sets. Two follow-up calls booked for tomorrow. Slow late afternoon but strong opening."),
        DemoEOD(name: "Masood Ali", color: .pink, status: .submitted, line: "Submitted · 7:55 PM", content: "96 dials, 14 connects, 2 sets. One close on the 1:1 pathway. Need more morning slots next week."),
        DemoEOD(name: "Aalian Khan", color: .blue, status: .pending, line: "Pending · still within window", content: ""),
        DemoEOD(name: "Abdelmalik", color: ivyGreen, status: .missing, line: "Missing · no EOD today", content: ""),
    ]
}
#endif

private extension MoneyInTab { var label: String { switch self { case .overview: "Overview"; case .deals: "Deals"; case .paymentPlans: "Plans"; case .setters: "Setters" } } }
private extension WorkTab { var label: String { switch self { case .actionItems: "Actions"; case .calendar: "Calendar"; case .crm: "CRM"; case .money: "Money" } } }
