import SwiftUI

// Work (founder 2026-08-18): the fifth tab, freed by folding Banking into
// Money. It is the person's own queue — today's report and the action items —
// and the landing place for the daily surfaces still coming over from the web
// portal (schedule, knowledge, testimonials).

struct BunWorkPage: View {
    @State private var store = BunStore.shared
    @State private var showEOD = false
    @State private var showKnowledge = false
    @State private var showTestimonials = false
    @State private var showLogSet = false

    private var filed: Bool { store.eodDue == false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                BunTitle(text: "Work")

                todayBlock

                edgeHairline

                VStack(alignment: .leading, spacing: 18) {
                    Text("Action items").font(BunType.section).foregroundStyle(BunTheme.ink)
                    BunActionItemsView(embedded: true)
                }

                edgeHairline

                shelf
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $showEOD) {
            BunEODFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showKnowledge) {
            BunKnowledgeSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showTestimonials) {
            BunTestimonialsSheet()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .sheet(isPresented: $showLogSet) {
            BunLogSetFlow()
                .presentationBackground(BunTheme.ground)
                .presentationCornerRadius(40)
        }
        .task {
            await store.loadTeam()
            await store.loadMyEODs()
            await store.loadActionItems()
            await store.loadSets()
            await store.loadTestimonials()
        }
        .refreshable {
            store.myEODs = nil
            store.actionItems = nil
            store.callItems = nil
            await store.loadMyEODs()
            await store.loadActionItems()
        }
    }

    /// One row, two states: the nag when today is unfiled, the receipt plus a
    /// way into the week when it is done. Founder-role accounts owe no EOD, so
    /// they get the week without the nag.
    private var todayBlock: some View {
        Button { showEOD = true } label: {
            HStack(spacing: 14) {
                Image(systemName: filed ? "checkmark" : "square.and.pencil")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(filed ? BunTheme.green : BunTheme.indigoLight)
                    .frame(width: 44, height: 44)
                    .background(BunTheme.field, in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text(filed ? "Today's report is in" : "End of day")
                        .font(BunType.rowTitle).foregroundStyle(BunTheme.ink)
                    Text(historyLine)
                        .font(BunType.caption).foregroundStyle(BunTheme.secondary).lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .regular)).foregroundStyle(BunTheme.secondary)
            }
            .padding(16)
            .background(BunTheme.raised, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(BunPressStyle())
    }

    /// The rest of the daily work, one tap each. Sets sit at the top because
    /// a booked call is the thing most likely to need recording mid-day.
    private var shelf: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Schedule").font(BunType.section).foregroundStyle(BunTheme.ink)
                Spacer()
                BunPillChip(symbol: "plus", label: "Log a set") { showLogSet = true }
            }
            let sets = Array((store.mySets ?? []).prefix(3))
            if sets.isEmpty {
                Text("Nothing booked yet.")
                    .font(bunFont(17)).foregroundStyle(BunTheme.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(sets) { set in
                        HStack(spacing: 14) {
                            BunAvatar(text: String(set.prospect.prefix(1)), size: 44,
                                      fill: BunStore.fill(for: set.prospect))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(set.prospect).font(BunType.rowTitle)
                                    .foregroundStyle(BunTheme.ink).lineLimit(1)
                                Text(PortalAPI.friendlyEventTime(set.eventStart))
                                    .font(BunType.caption).foregroundStyle(BunTheme.secondary)
                            }
                            Spacer()
                            if set.confirmedAt != nil {
                                BunTag(text: "Confirmed", tint: BunTheme.green,
                                       fill: BunTheme.green.opacity(0.14))
                            }
                        }
                        .frame(minHeight: 62)
                    }
                }
            }

            VStack(spacing: 12) {
                BunIconRow(symbol: "book", title: "Knowledge",
                           subtitle: "playbooks, policies and docs") { showKnowledge = true }
                    .frame(minHeight: 60)
                BunIconRow(symbol: "quote.bubble", title: "Testimonials",
                           subtitle: testimonialSubtitle) { showTestimonials = true }
                    .frame(minHeight: 60)
            }
            .padding(.top, 4)
        }
    }

    private var testimonialSubtitle: String {
        guard let rows = store.testimonials else { return "collect the proof" }
        let waiting = rows.filter { $0.status == "requested" || $0.status == "received" }.count
        return waiting == 0 ? "nothing waiting" : "\(waiting) waiting on you"
    }

    private var historyLine: String {
        guard let reports = store.myEODs else { return "File today's numbers" }
        if reports.isEmpty { return filed ? "See your week" : "File today's numbers" }
        return "\(reports.count) filed in the last 7 days"
    }

    private var edgeHairline: some View {
        Rectangle().fill(BunTheme.hairline).frame(height: 1)
            .padding(.horizontal, -22)
    }
}
