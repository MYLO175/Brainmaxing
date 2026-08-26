import Foundation

guard CommandLine.arguments.count == 3 else {
    fatalError("Expected an iconset directory and output ICNS path")
}

let iconset = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = URL(fileURLWithPath: CommandLine.arguments[2])

let entries: [(String, String)] = [
    ("icp4", "icon_16x16.png"),
    ("ic11", "icon_16x16@2x.png"),
    ("icp5", "icon_32x32.png"),
    ("ic12", "icon_32x32@2x.png"),
    ("ic07", "icon_128x128.png"),
    ("ic13", "icon_128x128@2x.png"),
    ("ic08", "icon_256x256.png"),
    ("ic14", "icon_256x256@2x.png"),
    ("ic09", "icon_512x512.png"),
    ("ic10", "icon_512x512@2x.png")
]

func bigEndianData(_ value: Int) -> Data {
    var integer = UInt32(value).bigEndian
    return Data(bytes: &integer, count: MemoryLayout<UInt32>.size)
}

var body = Data()
for (type, filename) in entries {
    let image = try Data(contentsOf: iconset.appendingPathComponent(filename))
    body.append(type.data(using: .ascii)!)
    body.append(bigEndianData(image.count + 8))
    body.append(image)
}

var archive = Data("icns".utf8)
archive.append(bigEndianData(body.count + 8))
archive.append(body)
try archive.write(to: output)
