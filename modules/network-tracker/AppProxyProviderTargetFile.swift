import NetworkExtension
import os.log

// This file belongs in the NetworkExtension Target (not the main app target).
// An Expo Config Plugin is required to generate this target via xcode tooling,
// or manually creating a new Target -> App Proxy Provider in Xcode.

class AppProxyProvider: NEAppProxyProvider {

    let sharedDefaults = UserDefaults(suiteName: "group.com.celsave.network")
    var totalMobileRx = 0
    var totalMobileTx = 0

    override func startProxy(options: [String : Any]? = nil, completionHandler: @escaping (Error?) -> Void) {

        // Load initial state
        totalMobileRx = sharedDefaults?.integer(forKey: "mobileRxBytes") ?? 0
        totalMobileTx = sharedDefaults?.integer(forKey: "mobileTxBytes") ?? 0

        // Inform OS we started successfully
        completionHandler(nil)
    }

    override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    override func handleNewFlow(_ flow: NEAppProxyFlow) {
        // Here we inspect flow origin/interface and sum up lengths.
        // E.g., for TCP streams or UDP datagrams

        // Pseudo logic: check if the interface is cellular
        // This usually requires parsing connection metadata or socket data logic
        // Because flow might be TCP (NEAppProxyTCPFlow) or UDP (NEAppProxyUDPFlow)

        if let tcpFlow = flow as? NEAppProxyTCPFlow {
            // Setup read/write loop to capture length
            // Instead of blocking, we only track bytes.
            // Since this is a transparent tracker, we would have to forward data to destination.
            // (Which is very complex and out of scope of a quick example, you need a full network tunnel parsing library like NetworkAnalyzer)

            // For demonstration, let's mock adding bytes periodically
            // In reality, you'd track the payload length on successful read/write

            self.totalMobileRx += 1024
            self.totalMobileTx += 1024
            self.saveCounts()

            tcpFlow.open(withLocalEndpoint: nil) { error in
                // Start tracking loop ...
            }
        }
    }

    private func saveCounts() {
        sharedDefaults?.set(self.totalMobileRx, forKey: "mobileRxBytes")
        sharedDefaults?.set(self.totalMobileTx, forKey: "mobileTxBytes")
        sharedDefaults?.synchronize() // Force write to shared app group
    }
}
