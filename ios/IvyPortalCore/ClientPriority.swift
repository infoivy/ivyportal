import Foundation

// CSM roster ordering (founder-directed 2026-08-15): the list is a priority
// queue, not an alphabet. 1:1 students paid the most and lead; inside a tier
// the struggling come before the healthy; offer-won students drop below the
// active roster ("that's something else"); scholarship students sit at the
// bottom of the barrel regardless of pathway.
public enum ClientPriority {
    static let graduatedPhases: Set<String> = ["offer_won", "testimonial", "graduated"]

    /// Lower ranks list first. Buckets, top to bottom:
    /// 1:1 at-risk → 1:1 watch → 1:1 healthy → group at-risk → group watch
    /// → group healthy → offer won (1:1 then group) → scholarship (which
    /// keeps the same internal order so a struggling scholar still leads
    /// the scholarship tail).
    public static func rank(isOneOnOne: Bool, phase: String?, paymentState: String?, band: HealthBand?) -> Int {
        let normalized = phase == "coaching_1on1" ? "training" : (phase ?? "onboarding")
        let urgency: Int = switch band {
        case .red: 0
        case .amber: 1
        case .green, nil: 2
        }
        let core: Int
        if graduatedPhases.contains(normalized) {
            core = 600 + (isOneOnOne ? 0 : 100)
        } else {
            core = (isOneOnOne ? 0 : 300) + urgency * 100
        }
        return (paymentState == "scholarship" ? 1000 : 0) + core
    }

    /// Full comparator: bucket first, then worst health, then name — so two
    /// at-risk 1:1 students order by who is furthest gone.
    public static func areInIncreasingOrder(
        lhsRank: Int, lhsScore: Int?, lhsName: String,
        rhsRank: Int, rhsScore: Int?, rhsName: String
    ) -> Bool {
        if lhsRank != rhsRank { return lhsRank < rhsRank }
        let lhs = lhsScore ?? Int.max
        let rhs = rhsScore ?? Int.max
        if lhs != rhs { return lhs < rhs }
        return lhsName.localizedCaseInsensitiveCompare(rhsName) == .orderedAscending
    }
}
