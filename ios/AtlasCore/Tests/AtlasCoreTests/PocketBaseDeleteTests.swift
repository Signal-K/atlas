import XCTest
@testable import AtlasCore

private final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var status = 204
    nonisolated(unsafe) static var seen: URLRequest?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.seen = request
        let res = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: res, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data())
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class PocketBaseDeleteTests: XCTestCase {
    private func client() -> PocketBaseClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        let c = PocketBaseClient(baseURL: URL(string: "https://pb.test")!, session: URLSession(configuration: config))
        c.token = "tok"
        return c
    }

    func testDeleteSendsAuthenticatedDELETEToTheRecord() async throws {
        StubProtocol.status = 204
        try await client().delete(collection: "users", id: "abc")
        XCTAssertEqual(StubProtocol.seen?.httpMethod, "DELETE")
        XCTAssertEqual(StubProtocol.seen?.url?.path, "/api/collections/users/records/abc")
        XCTAssertEqual(StubProtocol.seen?.value(forHTTPHeaderField: "Authorization"), "tok")
    }

    func testDeleteSurfacesServerRefusal() async {
        StubProtocol.status = 403
        do { try await client().delete(collection: "users", id: "abc"); XCTFail("expected failure") }
        catch { XCTAssertEqual(error as? PocketBaseError, .http(status: 403)) }
    }
}
