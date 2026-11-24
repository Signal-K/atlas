import AtlasCore
import SwiftUI

/// What a person can report. Raw values match the `atlas_content_reports` select fields.
enum ReportKind: String, Sendable {
    case askAnswer = "ask_answer"
    case submission, user, other
    case checkIn = "check_in"
}

enum ReportReason: String, CaseIterable, Identifiable, Sendable {
    case inaccurate, harmful, offensive, spam, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .inaccurate: "Wrong or misleading"
        case .harmful: "Unsafe or harmful"
        case .offensive: "Offensive"
        case .spam: "Spam"
        case .other: "Something else"
        }
    }
}

/// A report to file. `excerpt` is the text being reported, so it can be reviewed without the app.
struct ContentReport: Sendable, Equatable {
    var kind: ReportKind
    var reason: ReportReason
    var target: String
    var excerpt: String
    var details: String
}

protocol ContentReportService: Sendable {
    func submit(_ report: ContentReport, reporterID: String, token: String) async throws
}

struct LiveContentReportService: ContentReportService {
    private struct Body: Encodable {
        let reporter: String, kind: String, reason: String, target: String, excerpt: String, details: String
    }

    func submit(_ report: ContentReport, reporterID: String, token: String) async throws {
        let client = PocketBaseClient(baseURL: Config.pocketBaseURL)
        client.token = token
        _ = try await client.create(collection: "atlas_content_reports", body: Body(
            reporter: reporterID, kind: report.kind.rawValue, reason: report.reason.rawValue,
            target: String(report.target.prefix(200)), excerpt: String(report.excerpt.prefix(2000)),
            details: String(report.details.prefix(1000))))
    }
}

/// Sheet for reporting content or an Ask Atlas answer. Needs an account (so reports can't be
/// anonymous spam); guests are pointed at the support email instead.
struct ReportSheet: View {
    let session: SessionStore
    let kind: ReportKind
    let target: String
    let excerpt: String
    var service: ContentReportService = LiveContentReportService()
    let dismiss: () -> Void

    @State private var reason: ReportReason = .inaccurate
    @State private var details = ""
    @State private var sending = false
    @State private var done = false
    @State private var errorText: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if done {
                        Label("Thanks. We review reports within 24 hours.", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 16, weight: .semibold)).foregroundStyle(Brand.green)
                    } else if session.userID == nil {
                        Text("Sign in to send a report from the app, or email us and we will look at it.")
                            .font(.system(size: 15)).foregroundStyle(Brand.muted)
                        Button("Email support") { openURL(Config.supportMailURL(subject: "Report")) }
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.violet)
                    } else {
                        form
                    }
                }
                .padding(20)
            }
            .background(Brand.bg)
            .navigationTitle("Report").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(done ? "Done" : "Cancel") { dismiss() } } }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("What is wrong with this?").font(.system(size: 17, weight: .semibold)).foregroundStyle(Brand.ink)
            ForEach(ReportReason.allCases) { option in
                Button { reason = option } label: {
                    HStack {
                        Text(option.label).font(.system(size: 16)).foregroundStyle(Brand.ink)
                        Spacer()
                        Image(systemName: reason == option ? "largecircle.fill.circle" : "circle")
                            .foregroundStyle(reason == option ? Brand.violet : Brand.muted)
                    }
                    .frame(minHeight: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(reason == option ? .isSelected : [])
            }
            TextField("Anything else we should know? (optional)", text: $details, axis: .vertical)
                .lineLimit(3...6).padding(12)
                .background(Brand.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            if let errorText { Text(errorText).font(.system(size: 14)).foregroundStyle(Brand.flagship) }
            Button { Task { await send() } } label: {
                HStack(spacing: 8) {
                    if sending { ProgressView().controlSize(.small).tint(Brand.bg) }
                    Text(sending ? "Sending…" : "Send report")
                }
                .font(.system(size: 15, weight: .semibold)).foregroundStyle(Brand.bg)
                .frame(maxWidth: .infinity, minHeight: 46).background(Brand.violet, in: Capsule())
            }
            .buttonStyle(PressableStyle()).disabled(sending)
        }
    }

    private func send() async {
        guard let id = session.userID, let token = session.bearerToken else { return }
        sending = true; errorText = nil
        do {
            try await service.submit(
                ContentReport(kind: kind, reason: reason, target: target, excerpt: excerpt, details: details),
                reporterID: id, token: token)
            done = true
        } catch {
            errorText = "We couldn't send that. Check your connection, or email \(Config.supportEmail)."
        }
        sending = false
    }
}
