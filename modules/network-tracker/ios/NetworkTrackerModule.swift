import ExpoModulesCore
import NetworkExtension
import Foundation

// Define the name of the shared App Group
// NOTE: You MUST configure this exact App Group in the Apple Developer Portal
// and add it to your App's Capabilities.
let appGroupIdentifier = "group.com.celsave.network"

public class NetworkTrackerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NetworkTracker")

    // Request NEAppProxyProvider permissions
    AsyncFunction("requestPermissions") { (promise: Promise) in
      NEAppProxyProviderManager.loadAllFromPreferences { (managers, error) in
        if let error = error {
          promise.reject(error)
          return
        }

        let manager = managers?.first ?? NEAppProxyProviderManager()
        // Here we configure the App Proxy Manager setup (Local transparent proxy)
        // Normally, it requires a payload from an MDM to auto-start if it's supervised,
        // or a profile.

        manager.loadFromPreferences { error in
          if let error = error {
            promise.reject(error)
            return
          }
          let protocolConfig = NEAppProxyProviderProtocol()
          protocolConfig.serverAddress = "127.0.0.1" // Local loopback for capturing
          protocolConfig.providerBundleIdentifier = "com.celsave.NetworkTrackerExtension" // Must match exact bundle ID of extension

          manager.protocolConfiguration = protocolConfig
          manager.isEnabled = true

          manager.saveToPreferences { error in
            if let error = error {
              promise.reject(error)
            } else {
              promise.resolve(true)
            }
          }
        }
      }
    }

    AsyncFunction("startProxy") { (promise: Promise) in
      NEAppProxyProviderManager.loadAllFromPreferences { managers, error in
        guard let manager = managers?.first else {
          promise.reject(NSError(domain: "NetworkTracker", code: 1, userInfo: [NSLocalizedDescriptionKey: "No VPN profile found. Did you request permissions?"]))
          return
        }

        do {
          try manager.connection.startVPNTunnel()
          promise.resolve()
        } catch {
          promise.reject(error)
        }
      }
    }

    // Read the tracking bytes collected by the Proxy Provider Extension
    AsyncFunction("getNetworkUsage") { () -> [String: Int] in
      let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier)
      let rxBytes = sharedDefaults?.integer(forKey: "mobileRxBytes") ?? 0
      let txBytes = sharedDefaults?.integer(forKey: "mobileTxBytes") ?? 0

      return [
        "mobileRxBytes": rxBytes,
        "mobileTxBytes": txBytes
      ]
    }
  }
}
