import SwiftUI

// Work (founder 2026-08-18): the fifth tab, freed by folding Banking into
// Money. It is the person's own queue — today's report and the action items —
// and the landing place for the daily surfaces still coming over from the web
// portal (schedule, knowledge, chat).

struct BunWorkPage: View {
    @State private var store = BunStore.shared
    @State private var showEOD = false

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
        .task {
            await store.loadTeam()
            await store.loadMyEODs()
            await store.loadActionItems()
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
