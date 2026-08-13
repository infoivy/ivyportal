import SwiftUI

enum CSMTab: String, CaseIterable, Hashable {
    case students, csm, oneOnOne, testimonials, requests
    var label: String {
        switch self {
        case .students: "Students"
        case .csm: "CSM"
        case .oneOnOne: "1-on-1"
        case .testimonials: "Testimonials"
        case .requests: "Requests"
        }
    }
}

struct CustomersView: View {
    @State private var tab: CSMTab = .students
    @State private var roster: [StudentRosterItem]?
    @State private var loading = false
    @State private var loadError: String?
    @State private var selectedStudent: StudentRosterItem?

    private var signedIn: Bool { AuthStore.shared.isSignedIn }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ScreenHeader(title: "Clients", subtitle: "Students, CSM, and coaching")
                tabPicker
                if signedIn { liveContent } else { fixtureContent }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 112)
        }
        .scrollIndicators(.hidden)
        .task { await loadRosterIfNeeded() }
        .sheet(item: $selectedStudent) { student in
            StudentDetailSheet(student: student)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationBackground(.black)
        }
    }

    private var tabPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(CSMTab.allCases, id: \.self) { option in
                    Button(option.label) { withAnimation(.snappy(duration: 0.24)) { tab = option } }
                        .font(.subheadline.bold()).padding(.horizontal, 16).frame(minHeight: 42)
                        .background(tab == option ? Color.white.opacity(0.22) : ivySurface, in: Capsule())
                        .foregroundStyle(tab == option ? .white : .secondary)
                }
            }
            .padding(.trailing, 20)
        }.scrollIndicators(.hidden)
    }

    private func loadRosterIfNeeded() async {
        guard signedIn, roster == nil else { return }
        loading = true
        defer { loading = false }
        do {
            roster = try await PortalAPI.shared.students()
            loadError = nil
        } catch {
            loadError = "Could not load the student roster."
        }
    }

    // MARK: - Live (signed in)

    @ViewBuilder private var liveContent: some View {
        switch tab {
        case .students: liveStudents
        case .csm: liveCSM
        case .oneOnOne: liveOneOnOne
        case .testimonials: liveTestimonials
        case .requests: liveRequests
        }
    }

    private var liveStudents: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let roster {
                let active = roster.filter { $0.status == "active" }.count
                let flagged = roster.filter { $0.status == "ghosting" }.count
                HStack(spacing: 12) {
                    PerformanceStatCard(title: "Active students", value: "\(active)", context: "\(roster.count) total", color: .blue) { }
                    PerformanceStatCard(title: "Need attention", value: "\(flagged)", context: "ghosting or at risk", color: flagged > 0 ? .red : ivyGreen) { }
                }
                if roster.isEmpty {
                    StatusCard(symbol: "checkmark.circle", title: "No students", message: "The roster is empty.")
                } else {
                    SurfaceCard {
                        VStack(spacing: 0) {
                            ForEach(Array(roster.enumerated()), id: \.element.id) { index, student in
                                Button { selectedStudent = student } label: {
                                    studentRow(student)
                                }
                                .buttonStyle(PressableButtonStyle())
                                if index < roster.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                            }
                        }
                    }
                }
                Text("Source: real students table via your portal session").font(.caption).foregroundStyle(.tertiary)
            } else if loading {
                SkeletonCards(count: 4, height: 96)
            } else {
                StatusCard(symbol: "exclamationmark.triangle", title: "Roster unavailable", message: loadError ?? "Sign in to load verified students.", retry: { roster = nil; Task { await loadRosterIfNeeded() } })
            }
        }
    }

    private var liveCSM: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("CSM overview · students needing attention first").font(.subheadline).foregroundStyle(.secondary)
            if let roster {
                let attention = roster.filter { $0.status == "ghosting" || $0.phase == "onboarding" }
                if attention.isEmpty {
                    StatusCard(symbol: "checkmark.circle", title: "All clear", message: "No students currently need CSM attention.")
                } else {
                    SurfaceCard {
                        VStack(spacing: 0) {
                            ForEach(Array(attention.enumerated()), id: \.element.id) { index, student in
                                Button { selectedStudent = student } label: { studentRow(student) }
                                    .buttonStyle(PressableButtonStyle())
                                if index < attention.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                            }
                        }
                    }
                }
            } else if loading {
                SkeletonCards(count: 3, height: 96)
            } else {
                StatusCard(symbol: "exclamationmark.triangle", title: "Unavailable", message: loadError ?? "Sign in to load CSM data.", retry: { roster = nil; Task { await loadRosterIfNeeded() } })
            }
        }
    }

    private var liveOneOnOne: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("1-on-1 coaching · calls used and upcoming").font(.subheadline).foregroundStyle(.secondary)
            if let roster {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(roster.prefix(10).enumerated()), id: \.element.id) { index, student in
                            Button { selectedStudent = student } label: {
                                HStack(spacing: 12) {
                                    AvatarBadge(name: student.fullName, color: .blue)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(student.fullName).font(.headline).lineLimit(1)
                                        Text(student.phase?.replacingOccurrences(of: "_", with: " ") ?? "uncategorized").font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: "phone.fill").font(.caption).foregroundStyle(.secondary)
                                }.frame(minHeight: 62).contentShape(Rectangle())
                            }.buttonStyle(PressableButtonStyle())
                            if index < min(roster.count, 10) - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 54) }
                        }
                    }
                }
                Text("Calls used per student open in the student detail").font(.caption).foregroundStyle(.tertiary)
            } else if loading {
                SkeletonCards(count: 3, height: 96)
            } else {
                StatusCard(symbol: "exclamationmark.triangle", title: "Unavailable", message: loadError ?? "Sign in to load 1-on-1 data.", retry: { roster = nil; Task { await loadRosterIfNeeded() } })
            }
        }
    }

    private var liveTestimonials: some View {
        StatusCard(symbol: "star.fill", title: "Testimonials", message: "Collect ready testimonials from placed students. Wired to the portal testimonials table next.")
    }

    private var liveRequests: some View {
        StatusCard(symbol: "envelope.fill", title: "Requests", message: "Review pending student access requests. Wired to the portal pending_signups table next.")
    }

    // MARK: - Fixture (signed out)

    private var fixtureContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            MetricCard(title: "Active students", value: "47", context: "3 need attention", symbol: "person.2.fill", accent: .blue) { }
            VStack(alignment: .leading, spacing: 12) {
                Text("Needs attention").font(.title3.bold())
                SurfaceCard {
                    VStack(spacing: 0) {
                        fixtureRow("Amina H.", "Missing weekly check-in", .orange)
                        Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 56)
                        fixtureRow("Yusuf K.", "Coaching follow-up due", .red)
                        Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 56)
                        fixtureRow("Maryam A.", "Onboarding in progress", .blue)
                    }
                }
            }
            Text("Debug fixture · Sign in to load the real roster").font(.caption).foregroundStyle(.tertiary)
        }
    }

    private func fixtureRow(_ name: String, _ detail: String, _ color: Color) -> some View {
        HStack(spacing: 12) {
            Circle().fill(color.opacity(0.18)).frame(width: 44, height: 44)
                .overlay(Text(name.prefix(1)).font(.headline).foregroundStyle(color))
            VStack(alignment: .leading, spacing: 3) {
                Text(name).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
        }.frame(minHeight: 64).contentShape(Rectangle())
    }

    private func studentRow(_ student: StudentRosterItem) -> some View {
        HStack(spacing: 12) {
            AvatarBadge(name: student.fullName, color: .blue)
            VStack(alignment: .leading, spacing: 3) {
                Text(student.fullName).font(.headline).lineLimit(1)
                HStack(spacing: 6) {
                    StatusPill(title: student.phase?.replacingOccurrences(of: "_", with: " ") ?? "uncategorized", color: .blue)
                    StatusPill(title: student.status ?? "active", color: student.status == "ghosting" ? .red : ivyGreen)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
        }.frame(minHeight: 62).contentShape(Rectangle())
    }
}

// MARK: - Student detail

private struct StudentDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    let student: StudentRosterItem
    @State private var detailTab: StudentDetailTab = .overview
    @State private var calls: [StudentCall]?
    @State private var notes: [CSMNote]?
    @State private var eods: [StudentEOD]?
    @State private var actions: [StudentActionItem]?
    @State private var detailLoading = false
    @State private var detailError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    AvatarBadge(name: student.fullName, color: .blue)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(student.fullName).font(.title2.bold())
                        HStack(spacing: 6) {
                            StatusPill(title: student.phase?.replacingOccurrences(of: "_", with: " ") ?? "uncategorized", color: .blue)
                            StatusPill(title: student.status ?? "active", color: student.status == "ghosting" ? .red : ivyGreen)
                        }
                    }
                    Spacer()
                    Button("Done") { dismiss() }.frame(minHeight: 44)
                }
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(StudentDetailTab.allCases, id: \.self) { option in
                            Button(option.label) { withAnimation(.snappy(duration: 0.24)) { detailTab = option } }
                                .font(.subheadline.bold()).padding(.horizontal, 16).frame(minHeight: 40)
                                .background(detailTab == option ? Color.white.opacity(0.22) : ivySurface, in: Capsule())
                                .foregroundStyle(detailTab == option ? .white : .secondary)
                        }
                    }
                }.scrollIndicators(.hidden)
                detailContent
            }
            .padding(24)
        }
        .scrollIndicators(.hidden)
        .background(Color.black)
        .task { await loadDetail() }
    }

    private func loadDetail() async {
        detailLoading = true
        defer { detailLoading = false }
        do {
            async let c = PortalAPI.shared.studentCalls(studentId: student.id)
            async let n = PortalAPI.shared.csmNotes(studentId: student.id)
            async let e = PortalAPI.shared.studentEODs(studentId: student.id)
            async let a = PortalAPI.shared.studentActionItems(studentId: student.id)
            calls = try await c
            notes = try await n
            eods = try await e
            actions = try await a
            detailError = nil
        } catch {
            detailError = "Could not load the student detail."
        }
    }

    @ViewBuilder private var detailContent: some View {
        if detailLoading {
            SkeletonCards(count: 4, height: 96)
        } else if let detailError {
            StatusCard(symbol: "exclamationmark.triangle", title: "Unavailable", message: detailError, retry: { Task { await loadDetail() } })
        } else {
            switch detailTab {
            case .overview: overviewTab
            case .calls: callsTab
            case .eods: eodsTab
            case .notes: notesTab
            case .actions: actionsTab
            }
        }
    }

    private var overviewTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                PerformanceStatCard(title: "Calls", value: "\(calls?.count ?? 0)", context: "1-on-1 logged", color: .blue) { }
                PerformanceStatCard(title: "EODs", value: "\(eods?.count ?? 0)", context: "reports filed", color: ivyGreen) { }
            }
            HStack(spacing: 12) {
                PerformanceStatCard(title: "Open actions", value: "\(actions?.filter { !$0.done }.count ?? 0)", context: "outstanding", color: .orange) { }
                PerformanceStatCard(title: "CSM notes", value: "\(notes?.count ?? 0)", context: "on record", color: .purple) { }
            }
            if let latest = eods?.first {
                SurfaceCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Last EOD · \(latest.reportDate)").font(.caption.bold()).foregroundStyle(.secondary)
                        HStack(spacing: 16) {
                            miniStat("Applications", "\(latest.applicationsSubmitted)")
                            miniStat("Outreach", "\(latest.outreachSent)")
                            miniStat("Replies", "\(latest.replies)")
                            miniStat("Interviews", "\(latest.interviews)")
                        }
                        if let wins = latest.wins, !wins.isEmpty { Text("Win: \(wins)").font(.caption).foregroundStyle(ivyGreen) }
                        if let blockers = latest.blockers, !blockers.isEmpty { Text("Blocker: \(blockers)").font(.caption).foregroundStyle(.orange) }
                    }
                }
            }
        }
    }

    private var callsTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let calls, !calls.isEmpty {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(calls.enumerated()), id: \.element.id) { index, call in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(call.callDate).font(.caption.bold()).foregroundStyle(.secondary)
                                Text(call.coachNotes ?? "1-on-1 call").font(.subheadline).lineLimit(3)
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10)
                            if index < calls.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                        }
                    }
                }
            } else {
                StatusCard(symbol: "phone.fill", title: "No calls logged", message: "No 1-on-1 calls on record for this student.")
            }
        }
    }

    private var eodsTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let eods, !eods.isEmpty {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(eods.enumerated()), id: \.element.id) { index, eod in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(eod.reportDate).font(.caption.bold()).foregroundStyle(.secondary)
                                HStack(spacing: 14) {
                                    miniStat("Apps", "\(eod.applicationsSubmitted)")
                                    miniStat("Outreach", "\(eod.outreachSent)")
                                    miniStat("Replies", "\(eod.replies)")
                                    miniStat("Interviews", "\(eod.interviews)")
                                }
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10)
                            if index < eods.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                        }
                    }
                }
            } else {
                StatusCard(symbol: "doc.text.fill", title: "No EODs", message: "This student has not filed an end-of-day report yet.")
            }
        }
    }

    private var notesTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let notes, !notes.isEmpty {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(notes.enumerated()), id: \.element.id) { index, note in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(note.createdAt.prefix(10)).font(.caption.bold()).foregroundStyle(.secondary)
                                Text(note.note).font(.subheadline).lineLimit(4)
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10)
                            if index < notes.count - 1 { Divider().overlay(Color.white.opacity(0.08)) }
                        }
                    }
                }
            } else {
                StatusCard(symbol: "note.text", title: "No notes", message: "No CSM notes on record for this student.")
            }
        }
    }

    private var actionsTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let actions, !actions.isEmpty {
                SurfaceCard {
                    VStack(spacing: 0) {
                        ForEach(Array(actions.enumerated()), id: \.element.id) { index, item in
                            HStack(spacing: 12) {
                                Image(systemName: item.done ? "checkmark.circle.fill" : "circle").foregroundStyle(item.done ? ivyGreen : .secondary)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.text).font(.subheadline).strikethrough(item.done)
                                    if let due = item.dueDate { Text("Due \(due)").font(.caption2).foregroundStyle(.secondary) }
                                }
                                Spacer()
                                StatusPill(title: item.done ? "Done" : "Open", color: item.done ? ivyGreen : .orange)
                            }.frame(minHeight: 56).contentShape(Rectangle())
                            if index < actions.count - 1 { Divider().overlay(Color.white.opacity(0.08)).padding(.leading, 32) }
                        }
                    }
                }
            } else {
                StatusCard(symbol: "checklist", title: "No action items", message: "No action items on record for this student.")
            }
        }
    }

    private func miniStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.subheadline.bold()).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }
}

private enum StudentDetailTab: String, CaseIterable {
    case overview, calls, eods, notes, actions
    var label: String {
        switch self {
        case .overview: "Overview"
        case .calls: "Calls"
        case .eods: "EODs"
        case .notes: "Notes"
        case .actions: "Actions"
        }
    }
}
