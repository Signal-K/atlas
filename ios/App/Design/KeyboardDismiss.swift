import SwiftUI
import UIKit

enum Keyboard {
    static func dismiss() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

/// Installs a window tap that resigns the keyboard without stealing the tap
/// from buttons or text fields. SwiftUI has no tap-outside dismiss of its own,
/// and number pads have no return key, so the keyboard otherwise stays up and
/// covers the control underneath.
struct KeyboardDismissInstaller: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.install(on: uiView)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        private weak var installedOn: UIWindow?

        func install(on view: UIView) {
            DispatchQueue.main.async { [weak self, weak view] in
                guard let self, let view, let window = view.window else { return }
                if self.installedOn === window { return }
                if window.gestureRecognizers?.contains(where: { $0.name == "atlas.dismissKeyboard" }) == true {
                    self.installedOn = window
                    return
                }
                let tap = UITapGestureRecognizer(target: self, action: #selector(dismiss))
                tap.cancelsTouchesInView = false
                tap.delaysTouchesBegan = false
                tap.delaysTouchesEnded = false
                tap.delegate = self
                tap.name = "atlas.dismissKeyboard"
                window.addGestureRecognizer(tap)
                self.installedOn = window
            }
        }

        @objc func dismiss() { Keyboard.dismiss() }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            var view = touch.view
            while let current = view {
                if current is UITextField || current is UITextView { return false }
                view = current.superview
            }
            return true
        }
    }
}

extension View {
    /// Swipe the scroll view to dismiss, and put a Done key above every keyboard
    /// (including the decimal pad, which has no return key).
    func atlasKeyboardChrome() -> some View {
        scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { Keyboard.dismiss() }
                        .accessibilityLabel("Dismiss keyboard")
                }
            }
    }
}
