import Capacitor
import Foundation
import Network

@objc(EscposLanPlugin)
public class EscposLanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EscposLanPlugin"
    public let jsName = "EscposPrinter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "testPrint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discover", returnType: CAPPluginReturnPromise)
    ]

    @objc func print(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty,
              let port = call.getInt("port"), port > 0 else {
            call.reject("打印机地址或端口无效")
            return
        }
        let rawLines = (call.options["lines"] as? [Any]) ?? []
        let lines = rawLines.compactMap { $0 as? [String: Any] }
        guard !lines.isEmpty else {
            call.reject("小票内容为空")
            return
        }
        let copies = max(1, min(10, call.getInt("copies") ?? 1))
        let cut = call.getBool("cut", true)
        let cutMode = call.getString("cutMode") ?? "gs-v66"

        EscposSocket.shared.print(
            host: host,
            port: UInt16(port),
            lines: lines,
            copies: copies,
            cut: cut,
            cutMode: cutMode
        ) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let sentBytes):
                    call.resolve(["ok": true, "sentBytes": sentBytes])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func testPrint(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty,
              let port = call.getInt("port"), port > 0 else {
            call.reject("打印机地址或端口无效")
            return
        }
        let cutMode = call.getString("cutMode") ?? "gs-v66"
        let sample: [[String: Any]] = [
            ["text": "打印机测试", "align": "center", "bold": true, "doubleSize": true],
            ["text": "商鹏云 58mm", "align": "center"],
            ["text": "--------------------------------", "align": "left"],
            ["text": "连接正常", "align": "left"],
            ["spacer": true],
            ["text": "设置完成", "align": "center", "bold": true]
        ]
        EscposSocket.shared.print(
            host: host,
            port: UInt16(port),
            lines: sample,
            copies: 1,
            cut: true,
            cutMode: cutMode
        ) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let sentBytes):
                    call.resolve(["ok": true, "sentBytes": sentBytes, "message": "打印成功"])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func discover(_ call: CAPPluginCall) {
        let timeout = call.getInt("timeoutMs") ?? 2000
        PrinterDiscoverer.discover(timeoutMs: max(500, timeout)) { printers in
            DispatchQueue.main.async {
                call.resolve(["printers": printers])
            }
        }
    }
}

private final class EscposSocket {
    static let shared = EscposSocket()

    private struct EscposError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    func print(
        host: String,
        port: UInt16,
        lines: [[String: Any]],
        copies: Int,
        cut: Bool,
        cutMode: String,
        completion: @escaping (Result<Int, Error>) -> Void
    ) {
        guard let endpointPort = NWEndpoint.Port(rawValue: port) else {
            completion(.failure(EscposError(message: "端口无效")))
            return
        }
        let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: endpointPort)
        let connection = NWConnection(to: endpoint, using: .tcp)
        let queue = DispatchQueue(label: "escpos.lan.queue", qos: .userInitiated)
        connection.start(queue: queue)

        let payload = buildPayload(lines: lines, copies: copies, cut: cut, cutMode: cutMode)
        let timeout = DispatchWorkItem {
            connection.cancel()
            completion(.failure(EscposError(message: "打印机连接超时，请检查 IP 与同一 WiFi")))
        }
        queue.asyncAfter(deadline: .now() + 8, execute: timeout)

        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                timeout.cancel()
                connection.send(content: payload, completion: .contentProcessed { error in
                    if let error = error {
                        completion(.failure(error))
                    } else {
                        completion(.success(payload.count))
                    }
                    connection.cancel()
                })
            case .failed(let error):
                timeout.cancel()
                completion(.failure(error))
                connection.cancel()
            case .cancelled:
                timeout.cancel()
            default:
                break
            }
        }
    }

    private func buildPayload(
        lines: [[String: Any]],
        copies: Int,
        cut: Bool,
        cutMode: String
    ) -> Data {
        var data = Data([0x1B, 0x40])
        for _ in 0..<copies {
            for line in lines {
                if let spacer = line["spacer"] as? Bool, spacer {
                    data.append(Data([0x0A]))
                    continue
                }
                let text = (line["text"] as? String) ?? ""
                if (line["separator"] as? Bool) == true {
                    data.append(Data([0x1B, 0x61, 0x00]))
                    data.append(text.data(using: .ascii) ?? Data("--------------------------------".utf8))
                    data.append(Data([0x0A]))
                    continue
                }
                if text.isEmpty {
                    data.append(Data([0x0A]))
                    continue
                }
                let align = (line["align"] as? String) ?? "left"
                switch align {
                case "center":
                    data.append(Data([0x1B, 0x61, 0x01]))
                case "right":
                    data.append(Data([0x1B, 0x61, 0x02]))
                default:
                    data.append(Data([0x1B, 0x61, 0x00]))
                }
                if (line["bold"] as? Bool) == true {
                    data.append(Data([0x1B, 0x45, 0x01]))
                } else {
                    data.append(Data([0x1B, 0x45, 0x00]))
                }
                if (line["doubleSize"] as? Bool) == true {
                    data.append(Data([0x1D, 0x21, 0x11]))
                } else {
                    data.append(Data([0x1D, 0x21, 0x00]))
                }
                data.append(encodeChinese(text))
                data.append(Data([0x0A]))
            }
            data.append(Data([0x0A, 0x0A]))
        }
        if cut {
            if cutMode == "esc-i" {
                data.append(Data([0x1B, 0x69]))
            } else {
                data.append(Data([0x1D, 0x56, 0x42, 0x00]))
            }
        }
        return data
    }

    private func encodeChinese(_ value: String) -> Data {
        let gb18030 = CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.GB_18030_2000.rawValue))
        let encoding = String.Encoding(rawValue: gb18030)
        if let encoded = value.data(using: encoding) {
            return encoded
        }
        return Data(value.utf8)
    }
}

private final class PrinterDiscoverer {
    private static let serviceTypes = ["_printer._tcp", "_ipp._tcp", "_pdl-datastream._tcp"]

    static func discover(timeoutMs: Int, completion: @escaping ([[String: Any]]) -> Void) {
        let queue = DispatchQueue(label: "escpos.discover", qos: .userInitiated)
        var found = Set<String>()
        let group = DispatchGroup()
        let deadline = DispatchTime.now() + .milliseconds(timeoutMs)

        for serviceType in serviceTypes {
            group.enter()
            let descriptor = NWBrowser.Descriptor.bonjour(type: serviceType, domain: "local.")
            let browser = NWBrowser(for: descriptor, using: .tcp)
            browser.browseResultsChangedHandler = { results, _ in
                for result in results {
                    if case .hostPort(let host, _) = result.endpoint {
                        found.insert(host.debugDescription)
                    }
                }
            }
            browser.stateUpdateHandler = { state in
                if case .failed = state {
                    group.leave()
                }
            }
            browser.start(queue: queue)
            queue.asyncAfter(deadline: deadline) {
                browser.cancel()
                group.leave()
            }
        }

        group.notify(queue: DispatchQueue.global(qos: .userInitiated)) {
            let printers = found.map { ["host": $0, "name": $0] }
            completion(printers)
        }
    }
}
