import Foundation

public enum PortalRole: String, Hashable, Sendable {
    case admin, founder, cofounder, closer, setter, coach, csm
}

/// Grantable Home "view" roles (founder-directed 2026-07-31): independent of
/// the operating roles above. Holding `sales` opens the sales picture (Abu
/// Bilal), `fulfillment` opens the delivery picture (Faizan), both shows both,
/// neither falls back to the leadership brief. Founder can grant a view to
/// anyone or preview on a second account.
public enum HomeViewRole: String, CaseIterable, Hashable, Sendable {
    case sales, fulfillment
}

/// Which Home picture a member sees, derived from leadership + view roles.
public enum HomePicture: String, CaseIterable, Hashable, Sendable {
    case sales, fulfillment, leadership, personal
}

public enum HomePicturePolicy {
    private static let leadership: Set<PortalRole> = [.admin, .founder, .cofounder]

    public static func isLeader(_ roles: [PortalRole]) -> Bool {
        !leadership.isDisjoint(with: Set(roles))
    }

    /// ONE home per person, no switching (founder-directed 2026-08-15,
    /// superseding the 2026-08-14 Overview-first rule): a granted department
    /// view IS that leader's homepage — Abu Bilal (sales) lands on Sales,
    /// Faizan (fulfillment) lands on Fulfillment; a leader with neither view
    /// (the founder) lands on the general Overview; non-leaders get Personal.
    /// Holding both views resolves to Sales deterministically.
    public static func pictures(for roles: [PortalRole], views: [HomeViewRole]) -> [HomePicture] {
        guard isLeader(roles) else { return [.personal] }
        if views.contains(.sales) { return [.sales] }
        if views.contains(.fulfillment) { return [.fulfillment] }
        return [.leadership]
    }
}

// MARK: - Admin-managed access defaults (web role_access parity)

/// One `role_access` row: page hides/grants + the money blur, per role.
public struct RoleAccessRow: Sendable, Equatable {
    public let role: String
    public let hiddenPages: [String]
    public let grantedPages: [String]
    public let hideMoney: Bool

    public init(role: String, hiddenPages: [String], grantedPages: [String], hideMoney: Bool) {
        self.role = role
        self.hiddenPages = hiddenPages
        self.grantedPages = grantedPages
        self.hideMoney = hideMoney
    }
}

/// Port of web `nav-pages.ts`: admin hides/grants apply ONLY to the four
/// configurable roles; extra roles only ever ADD access; admin and founder
/// are never restricted. Server-side RLS stays the authorization boundary —
/// this controls discoverability, exactly like the web.
public enum RoleAccessPolicy {
    public static let configurableRoles: Set<String> = ["setter", "closer", "coach", "csm"]

    /// Web HARD_GATES: grants can never cross these route ceilings.
    static let hardGates: [String: Set<String>] = [
        "/payouts": ["admin", "cofounder"],
        "/finance": ["founder", "cofounder"],
        "/cards": ["founder", "cofounder"],
        "/crm": ["admin", "closer", "founder", "cofounder"],
        "/revenue": ["admin", "closer", "founder", "coach"],
        "/csm": ["admin", "csm", "coach", "founder", "cofounder"],
        "/calls": ["admin", "coach", "csm"],
        "/student-success": ["admin", "founder", "coach", "csm"],
        "/performance": ["admin", "founder", "cofounder"],
    ]

    /// Default role lists for the pages iOS surfaces (nil = every member).
    /// Hard-gated pages default to exactly their gate so an unknown page can
    /// never fall through to "visible to everyone".
    static let pageDefaults: [String: [String]?] = [
        "/eods": nil, "/action-items": nil, "/calendar": nil, "/knowledge": nil,
        "/students": ["admin", "closer", "coach", "csm", "founder", "cofounder"],
        "/csm": ["admin", "csm", "coach", "founder", "cofounder"],
        "/calls": ["admin", "coach", "csm"],
        "/testimonials": ["admin", "closer", "setter", "coach", "csm", "founder", "cofounder"],
        "/revenue": ["admin", "closer", "founder", "coach"],
        "/payouts": ["admin", "cofounder"],
        "/performance": ["admin", "founder", "cofounder"],
        "/finance": ["founder", "cofounder"],
        "/cards": ["founder", "cofounder"],
        "/crm": ["admin", "closer", "founder", "cofounder"],
        "/student-success": ["admin", "founder", "coach", "csm"],
    ]

    static func roleSeesPage(_ role: String, url: String, access: [RoleAccessRow]) -> Bool {
        let row = access.first { $0.role == role }
        let defaults = pageDefaults[url] ?? nil
        let byDefault = defaults == nil || defaults!.contains(role)
        if byDefault { return !(row?.hiddenPages ?? []).contains(url) }
        let gate = hardGates[url]
        let grantable = gate == nil || gate!.contains(role)
        return grantable && (row?.grantedPages ?? []).contains(url)
    }

    /// A page is hidden only if EVERY configurable role the user holds hides
    /// it; users with no configurable role keep their defaults.
    public static func pageHidden(_ url: String, roles: [PortalRole], access: [RoleAccessRow]) -> Bool {
        let names = roles.map(\.rawValue)
        if names.contains("admin") || names.contains("founder") { return false }
        let holding = names.filter { configurableRoles.contains($0) }
        guard !holding.isEmpty else { return false }
        return holding.allSatisfy { !roleSeesPage($0, url: url, access: access) }
    }

    /// Money figures hide only if every configurable role the user holds
    /// sets hide_money (web `moneyHidden`).
    public static func moneyHidden(roles: [PortalRole], access: [RoleAccessRow]) -> Bool {
        let names = roles.map(\.rawValue)
        if names.contains("admin") || names.contains("founder") { return false }
        let holding = names.filter { configurableRoles.contains($0) }
        guard !holding.isEmpty else { return false }
        return holding.allSatisfy { role in access.first { $0.role == role }?.hideMoney == true }
    }

    /// Work chips this account can see (maps chips onto web page URLs).
    public static func visibleWorkTabs(roles: [PortalRole], access: [RoleAccessRow]) -> [WorkTab] {
        WorkTab.allCases.filter { tab in
            let url: String
            switch tab {
            case .myEOD: url = "/eods"
            case .calendar: url = "/calendar"
            case .actionItems: url = "/action-items"
            case .knowledge: url = "/knowledge"
            }
            return !pageHidden(url, roles: roles, access: access)
        }
    }
}

/// Mercury IA (founder-directed 2026-08-17 rebrand): the bar is
/// Home · Activity (performance) · Tasks (work) · People (customers) · Money.
/// Settings (`more`) left the bar — it lives in the sidebar drawer.
public enum RootDestination: String, CaseIterable, Hashable, Sendable {
    case home, performance, work, customers, money, more
}

/// Settings rows in display order (founder-specified 2026-08-14, copied from
/// the Mochi settings list). `signOut` renders as the red Log Out card, never
/// as a nav row.
public enum MoreEntry: String, CaseIterable, Hashable, Sendable {
    case admin, profile, organization, team, tags, contentHub, socials, integrations, app, signOut
}

/// CONTRACT (2026-08-14): this hardcoded gating mirrors the web portal's
/// `role_access` table defaults plus its HARD_GATES route ceilings
/// (src/lib/nav-pages.ts). The web's admin screen can grant EXTRA pages to
/// setter/closer/coach/csm at runtime; iOS does not honor those grants yet
/// (planned: Phase E3 of the refinement plan). Until then, any change to
/// role_access defaults on the web MUST be mirrored here by hand, and iOS
/// must never be LOOSER than a web HARD_GATE.
public enum RoleDestinationPolicy {
    private static let leadership: Set<PortalRole> = [.admin, .founder, .cofounder]
    /// Money tab mirrors the web /revenue + /payouts gates' union — the roles
    /// that can see money surfaces at all. Never looser than a web HARD_GATE.
    private static let money: Set<PortalRole> = [.admin, .founder, .cofounder, .closer]

    /// Tab-bar items (Mercury rebrand 2026-08-17). `.more` is deliberately
    /// absent: Settings is a sidebar row, still reachable by everyone.
    public static func destinations(for roles: [PortalRole]) -> [RootDestination] {
        let roleSet = Set(roles)
        return RootDestination.allCases.filter { destination in
            switch destination {
            case .performance: !leadership.isDisjoint(with: roleSet)
            case .money: !money.isDisjoint(with: roleSet)
            case .more: false
            default: true
            }
        }
    }

    public static func moreEntries(for roles: [PortalRole]) -> [MoreEntry] {
        let roleSet = Set(roles)
        return MoreEntry.allCases.filter { entry in
            switch entry {
            case .profile, .tags, .app, .signOut:
                return true
            case .contentHub:
                // The iOS Content Hub is the STAFF template/link library
                // (founder-directed 2026-08-14: "setters can put in shortcuts
                // and links") — distinct from the web founder-only content
                // planning, which stays on the web.
                return true
            case .admin, .team, .organization, .integrations:
                return roleSet.contains(.admin)
            case .socials:
                // Social/IG surfaces stay FOUNDER-only; admin does not imply
                // access (business rule).
                return roleSet.contains(.founder)
            }
        }
    }
}
