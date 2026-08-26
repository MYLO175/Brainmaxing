import AppKit

guard CommandLine.arguments.count == 2 else {
    fatalError("Expected an output PNG path")
}

let size = NSSize(width: 1024, height: 1024)
let image = NSImage(size: size)
image.lockFocus()

let canvas = NSRect(origin: .zero, size: size)
NSColor.clear.setFill()
canvas.fill()

let tile = NSBezierPath(roundedRect: canvas.insetBy(dx: 42, dy: 42), xRadius: 218, yRadius: 218)
let gradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.07, green: 0.08, blue: 0.065, alpha: 1),
    NSColor(calibratedRed: 0.09, green: 0.17, blue: 0.135, alpha: 1)
])!
gradient.draw(in: tile, angle: -45)

let orbit = NSBezierPath(ovalIn: NSRect(x: 160, y: 160, width: 704, height: 704))
orbit.lineWidth = 14
NSColor(calibratedRed: 0.84, green: 1.0, blue: 0.34, alpha: 0.16).setStroke()
orbit.stroke()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 555, weight: .heavy),
    .foregroundColor: NSColor(calibratedRed: 0.84, green: 1.0, blue: 0.34, alpha: 1),
    .paragraphStyle: paragraph,
    .kern: -28
]
let mark = NSAttributedString(string: "Σ", attributes: attributes)
mark.draw(in: NSRect(x: 150, y: 150, width: 724, height: 650))

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let representation = NSBitmapImageRep(data: tiff),
      let png = representation.representation(using: .png, properties: [:]) else {
    fatalError("Could not render the app icon")
}

try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
