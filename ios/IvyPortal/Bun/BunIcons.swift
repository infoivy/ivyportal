import SwiftUI

// Tab-bar glyphs traced off the Mercury reference (founder 2026-08-18:
// "the home icon i want 1:1", then "their home and their banking icon is
// more rounded and maybe even a tiny bit thicker").
//
// Drawn rather than borrowed, because SF has no match: `house` lacks the
// doorway and the eave overhang, `list.bullet` uses round dots where the
// reference uses rounded squares, and `building.columns` has a sharp
// pediment and thin columns where the reference is thick and rounded.
//
// Geometry sampled from the reference at @3x (IMG_7555, home tab active):
// house 64x57px, list 55x47px, bank 57x57px, all with a ~5.5px stroke.
// Each is expressed in a 24-unit box with its ink CENTRED vertically, so
// every glyph in the bar shares one optical centre line.

private let unitStroke: CGFloat = 2.25   // ~5.6px at the reference's size

/// Mercury's house: overhanging eaves, tucked-in walls, rounded doorway.
struct BunHouseIcon: View {
    var size: CGFloat = 20

    var body: some View {
        Canvas { context, canvasSize in
            let u = canvasSize.width / 24
            // Ink spans y 1.0...20.3 in the raw trace; centre it in the box.
            let dy: CGFloat = (24 - (20.3 - 1.0)) / 2 - 1.0
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * u, y: (y + dy) * u)
            }

            // Corners carry a real radius rather than leaning on the stroke's
            // round join, but a TIGHT one: the trace widens from 2px to 10px
            // over three rows at the apex, and the base corners turn inside
            // ~1.1 units. Generous radii read as a blob, not this icon.
            var roof = Path()
            roof.move(to: p(1.1, 10.2))
            roof.addLine(to: p(11.24, 1.65))
            roof.addQuadCurve(to: p(12.76, 1.65), control: p(12, 1.0))
            roof.addLine(to: p(22.9, 10.2))

            // Base corners turn over ~2.2 units. Measured: the reference's
            // bottom edge pulls in 5px across its last rows where a 1.3-unit
            // radius only managed 3px, which is why ours read sharper.
            var walls = Path()
            walls.move(to: p(3.7, 9.0))
            walls.addLine(to: p(3.7, 18.1))
            walls.addQuadCurve(to: p(5.9, 20.3), control: p(3.7, 20.3))
            walls.addLine(to: p(18.1, 20.3))
            walls.addQuadCurve(to: p(20.3, 18.1), control: p(20.3, 20.3))
            walls.addLine(to: p(20.3, 9.0))

            // Doorway: open at the bottom. The head curves over ~4px in the
            // trace, so a 1.4-unit radius — rounded, but not the arch that
            // an unbounded quad gave.
            var door = Path()
            door.move(to: p(8.8, 20.3))
            door.addLine(to: p(8.8, 13.5))
            door.addQuadCurve(to: p(10.2, 12.1), control: p(8.8, 12.1))
            door.addLine(to: p(13.8, 12.1))
            door.addQuadCurve(to: p(15.2, 13.5), control: p(15.2, 12.1))
            door.addLine(to: p(15.2, 20.3))

            let stroke = StrokeStyle(lineWidth: unitStroke * u,
                                     lineCap: .round, lineJoin: .round)
            for path in [roof, walls, door] {
                context.stroke(path, with: .style(.foreground), style: stroke)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Mercury's bank: hollow pediment on a full-width lintel, four columns,
/// then a base bar and a separate ground bar.
struct BunBankIcon: View {
    var size: CGFloat = 20

    var body: some View {
        Canvas { context, canvasSize in
            let u = canvasSize.width / 24
            let dy: CGFloat = (24 - (22.7 - 1.4)) / 2 - 1.4
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * u, y: (y + dy) * u)
            }

            var pediment = Path()
            pediment.move(to: p(1.3, 7.6))
            pediment.addLine(to: p(12, 1.4))
            pediment.addLine(to: p(22.7, 7.6))

            var lintel = Path()
            lintel.move(to: p(1.3, 7.9))
            lintel.addLine(to: p(22.7, 7.9))

            var columns = Path()
            for x in [3.8, 9.2, 14.8, 20.2] as [CGFloat] {
                columns.move(to: p(x, 11.4))
                columns.addLine(to: p(x, 17.2))
            }

            var base = Path()
            base.move(to: p(2.5, 18.9))
            base.addLine(to: p(21.5, 18.9))

            var ground = Path()
            ground.move(to: p(1.3, 22.7))
            ground.addLine(to: p(22.7, 22.7))

            let stroke = StrokeStyle(lineWidth: unitStroke * u,
                                     lineCap: .round, lineJoin: .round)
            for path in [pediment, lintel, columns, base, ground] {
                context.stroke(path, with: .style(.foreground), style: stroke)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Mercury's transfers: two full-width shafts, the top arrow pointing right
/// and the bottom one left, heads at opposite ends. Traced at 50x55px.
struct BunTransferIcon: View {
    var size: CGFloat = 20

    var body: some View {
        Canvas { context, canvasSize in
            let u = canvasSize.width / 24
            let s: CGFloat = 24 / 55            // trace units -> box units
            let dx: CGFloat = (24 - 50 * s) / 2 // centre the narrower width
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: (x * s + dx) * u, y: y * s * u)
            }

            var top = Path()
            top.move(to: p(0, 13))
            top.addLine(to: p(49, 13))
            var topHead = Path()
            topHead.move(to: p(37, 1))
            topHead.addLine(to: p(49, 13))
            topHead.addLine(to: p(36.5, 26))

            var bottom = Path()
            bottom.move(to: p(50, 41))
            bottom.addLine(to: p(1, 41))
            var bottomHead = Path()
            bottomHead.move(to: p(13.5, 29))
            bottomHead.addLine(to: p(1, 41))
            bottomHead.addLine(to: p(13.5, 54))

            let stroke = StrokeStyle(lineWidth: unitStroke * u,
                                     lineCap: .round, lineJoin: .round)
            for path in [top, topHead, bottom, bottomHead] {
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
            let bullet: CGFloat = 4.8
            let barHeight: CGFloat = 2.2
            let barX: CGFloat = 7.0
            let barEnd: CGFloat = 23.6
            let pitch: CGFloat = 7.85
            let top: CGFloat = (24 - (bullet + 2 * pitch)) / 2

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
