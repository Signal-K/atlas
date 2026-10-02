import AtlasCore
import SwiftUI

struct ContentView: View {
    private let now = Date()

    var body: some View {
        VStack(spacing: 12) {
            Text("Atlas").font(.largeTitle.bold())
            Text(MoonPhase.name(at: now))
            Text("\(Int(MoonPhase.illuminationPercent(at: now).rounded()))% illuminated")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
