import SwiftUI

// Tab-bar glyphs traced off the Mercury reference (founder 2026-08-18:
// "the home icon i want 1:1"). Both are drawn rather than borrowed: SF's
// `house` has no doorway and no eave overhang, and `list.bullet` uses round
// dots where the reference uses rounded squares.
//
// Geometry came from the reference at @3x (IMG_7555, home tab active): the
// house measures 64x57px with a ~5.5px stroke, the list 55x47px. Both are
// expressed in a 24x24 unit box and scaled to the requested point size.

/// Mercury's house: overhanging eaves, tucked-in walls, open arched doorway.
struct BunHouseIcon: View {
    var size: CGFloat = 20
    var lineWidth: CGFloat = 2.05      // in 24-unit space

    var body: some View {
        Canvas { context, canvasSize in
            let u = canvasSize.width / 24
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * u, y: y * u) }

            // Roof: eave tip → apex → eave tip. The tips overhang the walls,
            // which is what separates this from SF's house.
            var roof = Path()
            roof.move(to: p(1.1, 10.2))
            roof.addLine(to: p(12, 1.0))
            roof.addLine(to: p(22.9, 10.2))

            // Walls start just under the roof stroke so there is no seam, and
            // land on the base line.
            var body = Path()
            body.move(to: p(3.7, 9.0))
            body.addLine(to: p(3.7, 20.3))
            body.addLine(to: p(20.3, 20.3))
            body.addLine(to: p(20.3, 9.0))

            // Doorway: open at the bottom, rounded lintel.
            var door = Path()
            door.move(to: p(8.9, 20.3))
            door.addLine(to: p(8.9, 13.7))
            door.addQuadCurve(to: p(12, 12.1), control: p(8.9, 12.1))
            door.addQuadCurve(to: p(15.1, 13.7), control: p(15.1, 12.1))
            door.addLine(to: p(15.1, 20.3))

            let stroke = StrokeStyle(lineWidth: lineWidth * u,
                                     lineCap: .round, lineJoin: .round)
            for path in [roof, body, door] {
                context.stroke(path, with: .style(.foreground), style: stroke)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Mercury's list: rounded-square bullets beside rounded bars, three rows.
struct BunListIcon: View {
    var size: CGFloat = 20

    var body: some View {
        Canvas { context, canvasSize in
            let u = canvasSize.width / 24
            let bullet: CGFloat = 4.8          // rounded square, side
            let barHeight: CGFloat = 2.2
            let barX: CGFloat = 7.0
            let barEnd: CGFloat = 23.6
            let pitch: CGFloat = 7.85
            let top: CGFloat = 1.75            // centres 20.5 units of content

            for row in 0..<3 {
                let y = top + CGFloat(row) * pitch
                let square = Path(roundedRect:
                    CGRect(x: 0, y: y * u, width: bullet * u, height: bullet * u),
                    cornerRadius: 1.6 * u, style: .continuous)
                context.fill(square, with: .style(.foreground))

                let barY = y + (bullet - barHeight) / 2
                let bar = Path(roundedRect:
                    CGRect(x: barX * u, y: barY * u,
                           width: (barEnd - barX) * u, height: barHeight * u),
                    cornerRadius: barHeight / 2 * u, style: .continuous)
                context.fill(bar, with: .style(.foreground))
            }
        }
        .frame(width: size, height: size)
    }
}
